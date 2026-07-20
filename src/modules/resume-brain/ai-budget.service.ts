import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AiUsage } from './ai/ai-chat-provider.interface';

/**
 * AiBudgetService — per-user cost guard for the paid AI extraction endpoint.
 *
 * The AI provider (Groq today) bills by token, so an unbounded `/extract`
 * endpoint is a financial DoS: one account could burn the whole quota. This
 * service meters each user against a rolling daily budget of both **requests**
 * and **tokens**, backed by Redis counters (the same Redis the rest of the
 * stack already runs on). `@Throttle` limits burst rate; this caps cumulative
 * daily spend — the two are complementary.
 *
 * Design choices:
 * - **Per-user** keying via the JWT `userId` (job seekers upload their own CV).
 * - **Rolling daily window** via a Redis TTL set on first write.
 * - **Fail-open**: if Redis is unreachable we log and allow the request rather
 *   than taking the feature down over a cache blip — BullMQ already depends on
 *   Redis, so a Redis outage degrades far more than this endpoint anyway.
 */
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  /**
   * Reject with `429 Too Many Requests` when the user has already reached their
   * daily request or token budget. Call BEFORE spending money on the provider.
   * A missing `userId` or an unreachable Redis both fail open (allow).
   */
  async assertWithinBudget(userId?: string): Promise<void> {
    if (!userId) return;

    const { requestBudget, tokenBudget } = this.limits();

    let requests: number;
    let tokens: number;
    try {
      [requests, tokens] = await this.readCounters(userId);
    } catch (err) {
      this.logger.warn(
        `AI budget check skipped (Redis unavailable): ${(err as Error).message}`,
      );
      return; // fail-open
    }

    if (requests >= requestBudget) {
      throw new HttpException(
        `Daily resume AI limit reached (${requestBudget} extractions/day). ` +
          'Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (tokens >= tokenBudget) {
      throw new HttpException(
        'Daily resume AI usage limit reached. Please try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Record one extraction's cost against the user's rolling daily window. Call
   * AFTER a successful provider call. Never throws — a metering failure must not
   * fail an otherwise-successful extraction.
   *
   * The incr and TTL check run in a single Redis pipeline, and the TTL is
   * (re)applied whenever the key has none (`TTL == -1`) — not only on the first
   * write. This closes the race where a crash between `incr` and `expire` left
   * a counter with no expiration, permanently locking the user out of the
   * feature, because the very next successful record heals the missing TTL.
   */
  async recordUsage(userId: string | undefined, usage: AiUsage): Promise<void> {
    if (!userId) return;

    const window = this.windowSeconds();
    try {
      await this.incrementWithWindow(this.requestKey(userId), 1, window);

      const tokens = Math.max(0, Math.floor(usage?.totalTokens ?? 0));
      if (tokens > 0) {
        await this.incrementWithWindow(this.tokenKey(userId), tokens, window);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to record AI usage for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Atomically increment a counter and guarantee it carries the window TTL.
   * `incr` + `ttl` go out in one pipeline; if the key has no expiration
   * (fresh key, or a leftover from a previous crash between incr and expire),
   * the TTL is applied so the daily window always resets.
   */
  private async incrementWithWindow(
    key: string,
    by: number,
    window: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    if (by === 1) {
      pipeline.incr(key);
    } else {
      pipeline.incrby(key, by);
    }
    pipeline.ttl(key);
    const results = await pipeline.exec();

    // ioredis returns [[err, value], ...]; surface the first command error.
    for (const [err] of results ?? []) {
      if (err) throw err;
    }

    const ttl = Number(results?.[1]?.[1] ?? -1);
    if (ttl < 0) {
      await this.redis.expire(key, window);
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async readCounters(userId: string): Promise<[number, number]> {
    const [req, tok] = await this.redis.mget(
      this.requestKey(userId),
      this.tokenKey(userId),
    );
    return [this.toCount(req), this.toCount(tok)];
  }

  private toCount(value: string | null): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private limits(): { requestBudget: number; tokenBudget: number } {
    return {
      requestBudget: this.config.get<number>(
        'RESUME_AI_DAILY_REQUEST_BUDGET',
        50,
      ),
      tokenBudget: this.config.get<number>(
        'RESUME_AI_DAILY_TOKEN_BUDGET',
        100_000,
      ),
    };
  }

  private windowSeconds(): number {
    return this.config.get<number>('RESUME_AI_BUDGET_WINDOW_SECONDS', 86_400);
  }

  private requestKey(userId: string): string {
    return `resume-brain:budget:req:${userId}`;
  }

  private tokenKey(userId: string): string {
    return `resume-brain:budget:tok:${userId}`;
  }
}
