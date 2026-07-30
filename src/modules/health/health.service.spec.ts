import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('HealthService', () => {
  let service: HealthService;

  const mockPrisma = { $queryRaw: jest.fn() };
  const mockRedis = { ping: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(HealthService);
  });

  describe('liveness', () => {
    it('reports ok with uptime and an ISO timestamp', () => {
      const result = service.liveness();
      expect(result.status).toBe('ok');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('readiness', () => {
    it('reports ok when database and redis both respond', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.readiness();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
      expect(result.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('reports degraded when the database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.readiness();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('down');
      expect(result.checks.redis.status).toBe('up');
    });

    it('reports degraded when redis is down', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.readiness();

      expect(result.status).toBe('degraded');
      expect(result.checks.redis.status).toBe('down');
    });

    it('never leaks failure details into the response', async () => {
      const secretDetail = 'postgresql://user:supersecret@db:5432/x';
      mockPrisma.$queryRaw.mockRejectedValue(new Error(secretDetail));
      mockRedis.ping.mockRejectedValue(new Error(secretDetail));

      const result = await service.readiness();

      expect(JSON.stringify(result)).not.toContain('supersecret');
      expect(JSON.stringify(result)).not.toContain('postgresql://');
    });

    it('bounds a hanging dependency probe instead of hanging forever', async () => {
      jest.useFakeTimers();
      try {
        mockPrisma.$queryRaw.mockImplementation(() => new Promise(() => undefined));
        mockRedis.ping.mockResolvedValue('PONG');

        const pending = service.readiness();
        await jest.advanceTimersByTimeAsync(2_001);
        const result = await pending;

        expect(result.status).toBe('degraded');
        expect(result.checks.database.status).toBe('down');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
