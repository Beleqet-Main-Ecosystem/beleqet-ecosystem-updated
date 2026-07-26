import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/modules/redis/redis.module';

/**
 * Integration test for the health endpoints.
 *
 * Boots a real Nest application (routing + controller + service wired
 * together, same global prefix as `main.ts`) and exercises both probes over
 * HTTP with `supertest`. `PrismaService` and the Redis client are mocked so
 * the test controls dependency reachability; in production those providers
 * come from the global Prisma/Redis modules. The full-stack path against live
 * PostgreSQL and Redis is exercised by the CI integration job and the staging
 * simulation.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = { $queryRaw: jest.fn() };
  const mockRedis = { ping: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');
  });

  it('GET /api/v1/health returns 200 with liveness payload', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('GET /api/v1/health/ready returns 200 when dependencies are up', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.status).toBe('up');
    expect(response.body.checks.redis.status).toBe('up');
  });

  it('GET /api/v1/health/ready returns 503 when the database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('down'));
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.database.status).toBe('down');
  });

  it('health responses never contain secret-shaped content', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('postgresql://user:secretpw@db:5432/app'));
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('secretpw');
    expect(body).not.toContain('postgresql://');
  });
});
