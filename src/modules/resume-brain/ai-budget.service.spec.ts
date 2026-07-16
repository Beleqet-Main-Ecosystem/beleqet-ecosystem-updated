import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiBudgetService } from './ai-budget.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AiUsage } from './ai/ai-chat-provider.interface';

const usage = (total: number): AiUsage => ({
  promptTokens: Math.floor(total * 0.7),
  completionTokens: Math.ceil(total * 0.3),
  totalTokens: total,
});

/** ConfigService stub driven by a plain map, with the production defaults. */
function configWith(values: Record<string, unknown> = {}) {
  return {
    get: <T>(key: string, fallback?: T): T =>
      (values[key] as T) ?? (fallback as T),
  } as unknown as ConfigService;
}

describe('AiBudgetService', () => {
  let redis: {
    mget: jest.Mock;
    incr: jest.Mock;
    incrby: jest.Mock;
    expire: jest.Mock;
    pipeline: jest.Mock;
  };
  /** Queue of TTL replies the pipeline mock hands back, one per exec(). */
  let ttlReplies: number[];

  async function build(config = configWith()): Promise<AiBudgetService> {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AiBudgetService,
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    return moduleRef.get(AiBudgetService);
  }

  beforeEach(() => {
    ttlReplies = [];
    redis = {
      mget: jest.fn().mockResolvedValue([null, null]),
      incr: jest.fn().mockResolvedValue(1),
      incrby: jest.fn().mockResolvedValue(0),
      expire: jest.fn().mockResolvedValue(1),
      // Pipeline mock: queues incr/incrby/ttl, delegates to the flat mocks on
      // exec() and returns ioredis-style [[err, value], ...] tuples.
      pipeline: jest.fn(() => {
        const queued: Array<() => Promise<unknown>> = [];
        const pipe = {
          incr: (key: string) => {
            queued.push(() => redis.incr(key));
            return pipe;
          },
          incrby: (key: string, by: number) => {
            queued.push(() => redis.incrby(key, by));
            return pipe;
          },
          ttl: () => {
            queued.push(async () => ttlReplies.shift() ?? -1);
            return pipe;
          },
          exec: async () => {
            const results: Array<[Error | null, unknown]> = [];
            for (const run of queued) {
              try {
                results.push([null, await run()]);
              } catch (err) {
                results.push([err as Error, null]);
              }
            }
            return results;
          },
        };
        return pipe;
      }),
    };
  });

  describe('assertWithinBudget', () => {
    it('allows a user who is under both budgets', async () => {
      redis.mget.mockResolvedValue(['3', '5000']);
      const service = await build();
      await expect(service.assertWithinBudget('user-1')).resolves.toBeUndefined();
    });

    it('rejects with 429 once the daily request budget is reached', async () => {
      redis.mget.mockResolvedValue(['50', '0']); // default request budget = 50
      const service = await build();
      await expect(service.assertWithinBudget('user-1')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('rejects with 429 once the daily token budget is reached', async () => {
      redis.mget.mockResolvedValue(['1', '100000']); // default token budget = 100000
      const service = await build();
      await expect(service.assertWithinBudget('user-1')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('honours configured budget overrides', async () => {
      redis.mget.mockResolvedValue(['3', '0']);
      const service = await build(
        configWith({ RESUME_AI_DAILY_REQUEST_BUDGET: 3 }),
      );
      await expect(service.assertWithinBudget('user-1')).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('fails open (allows) when userId is missing', async () => {
      const service = await build();
      await expect(service.assertWithinBudget(undefined)).resolves.toBeUndefined();
      expect(redis.mget).not.toHaveBeenCalled();
    });

    it('fails open (allows) when Redis is unavailable', async () => {
      redis.mget.mockRejectedValue(new Error('ECONNREFUSED'));
      const service = await build();
      await expect(service.assertWithinBudget('user-1')).resolves.toBeUndefined();
    });
  });

  describe('recordUsage', () => {
    it('increments the request counter and meters tokens', async () => {
      ttlReplies = [-2, -2]; // fresh keys → no TTL yet
      const service = await build();

      await service.recordUsage('user-1', usage(280));

      expect(redis.incr).toHaveBeenCalledWith('resume-brain:budget:req:user-1');
      expect(redis.incrby).toHaveBeenCalledWith(
        'resume-brain:budget:tok:user-1',
        280,
      );
      // TTL is set on the first write so the window is a fixed 24h.
      expect(redis.expire).toHaveBeenCalledWith(
        'resume-brain:budget:req:user-1',
        86_400,
      );
      expect(redis.expire).toHaveBeenCalledWith(
        'resume-brain:budget:tok:user-1',
        86_400,
      );
    });

    it('does not reset the TTL on subsequent requests in the window', async () => {
      redis.incr.mockResolvedValue(4); // not the first request
      redis.incrby.mockResolvedValue(900); // key already existed
      ttlReplies = [80_000, 80_000]; // both keys still carry a TTL
      const service = await build();

      await service.recordUsage('user-1', usage(280));

      expect(redis.expire).not.toHaveBeenCalled();
    });

    it('heals a counter left without a TTL by a previous crash', async () => {
      // Simulates the race the reviewer flagged: a crash between incr and
      // expire leaves the key persistent (TTL == -1). The next record must
      // re-apply the window instead of locking the user out forever.
      redis.incr.mockResolvedValue(7); // key existed before this call
      redis.incrby.mockResolvedValue(900);
      ttlReplies = [-1, 80_000]; // request key lost its TTL, token key is fine
      const service = await build();

      await service.recordUsage('user-1', usage(280));

      expect(redis.expire).toHaveBeenCalledWith(
        'resume-brain:budget:req:user-1',
        86_400,
      );
      expect(redis.expire).toHaveBeenCalledTimes(1);
    });

    it('skips the token write when the call reported zero tokens', async () => {
      const service = await build();
      await service.recordUsage('user-1', usage(0));
      expect(redis.incrby).not.toHaveBeenCalled();
    });

    it('is a no-op when userId is missing', async () => {
      const service = await build();
      await service.recordUsage(undefined, usage(100));
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('never throws when Redis fails mid-record', async () => {
      redis.incr.mockRejectedValue(new Error('down'));
      const service = await build();
      await expect(service.recordUsage('user-1', usage(100))).resolves.toBeUndefined();
    });
  });
});
