import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';

/**
 * HTTP security tests for Admin Stats.
 * Uses the real RolesGuard + mocked JWT/Prisma/Redis so CI proves 403 vs 200
 * without a live database.
 */
describe('AdminStats HTTP security', () => {
  let app: INestApplication;
  let mockUser: { userId: string; email: string; role: string } | null = null;

  const overviewPayload = {
    generatedAt: '2026-08-04T00:00:00.000Z',
    currency: 'ETB',
    amountUnit: 'minor',
    range: { preset: '30d', from: '2026-07-05', to: '2026-08-04', tz: 'UTC' },
    cards: {
      totalUsers: 5,
      activeUsers: { count: 2, windowDays: 30, basis: 'last_login' },
      totalProjects: 3,
      activeProjects: 1,
      revenueThisMonth: { amount: 0, month: '2026-08' },
      revenueChangeVsLastMonth: {
        thisMonthAmount: 0,
        lastMonthAmount: 0,
        percentChange: null,
        direction: 'flat',
      },
    },
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const redis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const adminStatsService = {
    getOverview: jest.fn().mockResolvedValue(overviewPayload),
    getRevenueChart: jest.fn().mockResolvedValue({ series: [] }),
    getUserGrowthChart: jest.fn().mockResolvedValue({ series: [] }),
    getProjectBreakdown: jest.fn().mockResolvedValue({ statusSummary: [], recentProjects: [] }),
    getDashboardStats: jest.fn().mockResolvedValue({ totalUsers: 5 }),
    exportOverviewCsv: jest.fn().mockReturnValue('metric,value\n'),
    exportRevenueCsv: jest.fn().mockReturnValue('date,revenue,currency\n'),
    exportUsersCsv: jest.fn().mockReturnValue('date,registrations,active_users\n'),
    exportStatusCsv: jest.fn().mockReturnValue('status,count\n'),
    exportRecentProjectsCsv: jest.fn().mockReturnValue('id,title,status,owner_first_name,created_at\n'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminStatsController],
      providers: [
        { provide: AdminStatsService, useValue: adminStatsService },
        RolesGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          if (!mockUser) return false;
          const req = ctx.switchToHttp().getRequest();
          req.user = { ...mockUser };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    redis.get.mockResolvedValue(null);
  });

  const securedPaths = [
    '/admin-stats/overview',
    '/admin-stats/charts/revenue',
    '/admin-stats/charts/users',
    '/admin-stats/projects/breakdown',
    '/admin-stats/dashboard',
  ];

  it('declares ADMIN role and view:stats permission on the controller', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminStatsController)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminStatsController)).toEqual(['view:stats']);
  });

  it.each(securedPaths)('%s returns 403 for unauthenticated callers', async (path) => {
    mockUser = null;
    await request(app.getHttpServer()).get(path).expect(403);
    expect(adminStatsService.getOverview).not.toHaveBeenCalled();
  });

  it.each(securedPaths)('%s returns 403 for a regular JOB_SEEKER', async (path) => {
    mockUser = { userId: 'user-1', email: 'seeker@example.com', role: 'JOB_SEEKER' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      rbacRoles: [{ permissions: [{ action: 'create:jobs' }] }],
    });

    const res = await request(app.getHttpServer()).get(path).expect(403);
    expect(res.body.message).toBe('Forbidden resource');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('dashboard');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('admin-stats');
  });

  it.each(securedPaths)('%s returns 403 for EMPLOYER without view:stats', async (path) => {
    mockUser = { userId: 'emp-1', email: 'employer@example.com', role: 'EMPLOYER' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'emp-1',
      rbacRoles: [{ permissions: [{ action: 'create:jobs' }, { action: 'manage:disputes' }] }],
    });

    await request(app.getHttpServer()).get(path).expect(403);
  });

  it.each(securedPaths)('%s returns 403 for ADMIN role missing view:stats permission', async (path) => {
    mockUser = { userId: 'admin-no-perm', email: 'admin@example.com', role: 'ADMIN' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-no-perm',
      rbacRoles: [{ permissions: [{ action: 'manage:users' }] }],
    });

    await request(app.getHttpServer()).get(path).expect(403);
  });

  it('GET /admin-stats/overview returns 200 for ADMIN with view:stats', async () => {
    mockUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      rbacRoles: [{ permissions: [{ action: 'view:stats' }, { action: 'manage:users' }] }],
    });

    const res = await request(app.getHttpServer()).get('/admin-stats/overview').expect(200);
    expect(res.body.cards.totalUsers).toBe(5);
    expect(adminStatsService.getOverview).toHaveBeenCalled();
  });

  it('GET /admin-stats/charts/revenue returns 200 for authorized admin', async () => {
    mockUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
    redis.get.mockResolvedValue(JSON.stringify(['view:stats']));

    await request(app.getHttpServer()).get('/admin-stats/charts/revenue').expect(200);
    expect(adminStatsService.getRevenueChart).toHaveBeenCalled();
  });

  it('CSV export routes also require admin access', async () => {
    mockUser = { userId: 'user-1', email: 'seeker@example.com', role: 'JOB_SEEKER' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      rbacRoles: [{ permissions: [] }],
    });

    await request(app.getHttpServer()).get('/admin-stats/overview/export.csv').expect(403);

    mockUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };
    redis.get.mockResolvedValue(JSON.stringify(['view:stats']));
    await request(app.getHttpServer()).get('/admin-stats/overview/export.csv').expect(200);
  });
});

describe('RolesGuard against AdminStats metadata', () => {
  let guard: RolesGuard;
  const prisma = { user: { findUnique: jest.fn() } };
  const redis = { get: jest.fn(), set: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    guard = new RolesGuard(new Reflector(), prisma as unknown as PrismaService, redis as never);
  });

  function ctx(user: { userId: string; role: string } | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => AdminStatsController.prototype.getOverview,
      getClass: () => AdminStatsController,
    } as unknown as ExecutionContext;
  }

  it('denies JOB_SEEKER', async () => {
    await expect(guard.canActivate(ctx({ userId: 'u1', role: 'JOB_SEEKER' }))).resolves.toBe(false);
  });

  it('denies ADMIN without view:stats', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      rbacRoles: [{ permissions: [{ action: 'manage:users' }] }],
    });
    await expect(guard.canActivate(ctx({ userId: 'a1', role: 'ADMIN' }))).resolves.toBe(false);
  });

  it('allows ADMIN with view:stats', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'a1',
      rbacRoles: [{ permissions: [{ action: 'view:stats' }] }],
    });
    await expect(guard.canActivate(ctx({ userId: 'a1', role: 'ADMIN' }))).resolves.toBe(true);
  });
});
