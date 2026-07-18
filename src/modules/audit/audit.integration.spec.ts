import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { ValidationPipe } from '@nestjs/common';
import { AuditModule } from './audit.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Integration test for the Audit Trail module. Verifies the full
 * request pipeline (guards → controller → service → Prisma call shape)
 * without requiring a live database — PrismaService is replaced with an
 * in-memory fake so this suite runs fast and deterministically in CI.
 */
describe('Audit Trail (integration)', () => {
  let app: INestApplication;

  const seededLogs = [
    {
      id: '1',
      eventType: 'USER_LOGIN',
      entityId: 'user-1',
      entityType: 'User',
      payload: {},
      processedBy: null,
      createdAt: new Date('2026-01-01'),
    },
    {
      id: '2',
      eventType: 'ESCROW_RELEASED',
      entityId: 'txn-1',
      entityType: 'Payment',
      payload: { amount: 1000, currency: 'ETB' },
      processedBy: null,
      createdAt: new Date('2026-01-02'),
    },
  ];

  const fakePrisma = {
    eventLog: {
      create: jest.fn().mockResolvedValue(seededLogs[0]),
      findMany: jest.fn().mockImplementation(({ where }: { where?: { entityType?: string } }) => {
        if (where?.entityType) {
          return Promise.resolve(seededLogs.filter((l) => l.entityType === where.entityType));
        }
        return Promise.resolve(seededLogs);
      }),
      count: jest.fn().mockImplementation(({ where }: { where?: { entityType?: string } }) => {
        if (where?.entityType) {
          return Promise.resolve(seededLogs.filter((l) => l.entityType === where.entityType).length);
        }
        return Promise.resolve(seededLogs.length);
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuditModule],
    })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      // Simulates an authenticated ADMIN request without needing a real JWT.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { userId: 'admin-1', email: 'admin@beleqet.com', role: 'ADMIN' };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /audit-logs returns all seeded entries with correct pagination shape', async () => {
    const res = await request(app.getHttpServer()).get('/audit-logs').expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({ total: 2, page: 1, limit: 25, totalPages: 1 }),
    );
    expect(res.body.items).toHaveLength(2);
  });

  it('GET /audit-logs?entityType=Payment filters correctly (Multi-Currency interaction)', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ entityType: 'Payment' })
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].entityType).toBe('Payment');
    expect(res.body.items[0].payload).toEqual({ amount: 1000, currency: 'ETB' });
  });

  it('GET /audit-logs rejects invalid query params (class-validator integration)', async () => {
    await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ dateFrom: 'not-a-date' })
      .expect(400);
  });

  it('GET /audit-logs never exposes an update or delete route (immutability by API design)', async () => {
    await request(app.getHttpServer()).patch('/audit-logs/1').expect(404);
    await request(app.getHttpServer()).delete('/audit-logs/1').expect(404);
  });
});
