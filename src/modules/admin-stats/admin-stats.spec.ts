import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { FreelanceJobStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ADMIN_STATS_CURRENCY_CONVERTER } from './currency-converter.port';
import { ADMIN_STATS_FIXTURES, EXPECTED_FROM_FIXTURES } from './__fixtures__/admin-stats.fixtures';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsRepository } from './admin-stats.repository';
import { AdminStatsService } from './admin-stats.service';
import { eachDayKey, resolveStatsRange } from './utils/date-range.util';

describe('date-range.util', () => {
  it('fills every day including zeros-ready keys', () => {
    const keys = eachDayKey('2026-08-01', '2026-08-03', 'UTC');
    expect(keys).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('resolves 7d preset to 7 inclusive days', () => {
    const now = new Date('2026-08-04T12:00:00.000Z');
    const resolved = resolveStatsRange({ range: '7d', tz: 'UTC' }, now);
    expect(resolved.from).toBe('2026-07-29');
    expect(resolved.to).toBe('2026-08-04');
    expect(resolved.granularity).toBe('day');
  });

  it('rejects inverted custom ranges', () => {
    expect(() =>
      resolveStatsRange({ range: 'custom', from: '2026-08-10', to: '2026-08-01', tz: 'UTC' }),
    ).toThrow(BadRequestException);
  });
});

describe('AdminStatsService', () => {
  let service: AdminStatsService;
  let repository: jest.Mocked<AdminStatsRepository>;

  beforeEach(async () => {
    repository = {
      countTotalUsers: jest.fn().mockResolvedValue(0),
      countActiveUsers: jest.fn().mockResolvedValue({ count: 0, basis: 'last_login' }),
      countTotalProjects: jest.fn().mockResolvedValue(0),
      countActiveProjects: jest.fn().mockResolvedValue(0),
      countActiveContracts: jest.fn().mockResolvedValue(0),
      countCompletedFreelanceJobs: jest.fn().mockResolvedValue(0),
      findEscrowPlatformFees: jest.fn().mockResolvedValue([]),
      findSucceededPayments: jest.fn().mockResolvedValue([]),
      findRefundedPayments: jest.fn().mockResolvedValue([]),
      findSucceededSubscriptionTx: jest.fn().mockResolvedValue([]),
      findUserRegistrationDates: jest.fn().mockResolvedValue([]),
      findUserLastLoginDates: jest.fn().mockResolvedValue([]),
      groupProjectsByStatus: jest.fn().mockResolvedValue([]),
      findRecentProjects: jest.fn().mockResolvedValue([]),
      groupUsersByRole: jest.fn().mockResolvedValue([]),
      countInactiveUsers: jest.fn().mockResolvedValue(0),
      countUnverifiedEmails: jest.fn().mockResolvedValue(0),
      countKycByStatus: jest.fn().mockResolvedValue(0),
      groupEmploymentJobsByStatus: jest.fn().mockResolvedValue([]),
      groupContractsByStatus: jest.fn().mockResolvedValue([]),
      countApplications: jest.fn().mockResolvedValue(0),
      countBids: jest.fn().mockResolvedValue(0),
      countOpenDisputes: jest.fn().mockResolvedValue(0),
      countActiveSubscriptions: jest.fn().mockResolvedValue(0),
      countEscrowByStatus: jest.fn().mockResolvedValue(0),
      sumEscrowGrossReleased: jest.fn().mockResolvedValue([]),
      countPaymentsByStatus: jest.fn().mockResolvedValue(0),
      groupRegistrationsByRole: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<AdminStatsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminStatsService,
        { provide: AdminStatsRepository, useValue: repository },
        {
          provide: ADMIN_STATS_CURRENCY_CONVERTER,
          useValue: {
            convertCurrency: jest.fn((amount: number, from: string, to: string) =>
              from === to ? amount : amount,
            ),
          },
        },
        {
          provide: I18nService,
          useValue: { t: jest.fn().mockReturnValue('Dashboard Statistics') },
        },
      ],
    }).compile();

    service = module.get(AdminStatsService);
  });

  describe('getOverview', () => {
    it('returns zeros gracefully when the database is empty', async () => {
      const result = await service.getOverview({ currency: 'ETB', range: '30d', tz: 'UTC' });

      expect(result.cards.totalUsers).toBe(0);
      expect(result.cards.activeUsers.count).toBe(0);
      expect(result.cards.totalProjects).toBe(0);
      expect(result.cards.activeProjects).toBe(0);
      expect(result.cards.revenueThisMonth.amount).toBe(0);
      expect(result.cards.revenueChangeVsLastMonth.percentChange).toBeNull();
      expect(result.cards.revenueChangeVsLastMonth.direction).toBe('flat');
      expect(result.amountUnit).toBe('minor');
    });

    it('maps 5 users → totalUsers 5 (fixture calculator)', async () => {
      repository.countTotalUsers.mockResolvedValue(EXPECTED_FROM_FIXTURES.totalUsers);
      repository.countActiveUsers.mockResolvedValue({
        count: EXPECTED_FROM_FIXTURES.activeUsers30d,
        basis: 'last_login',
      });
      repository.countTotalProjects.mockResolvedValue(EXPECTED_FROM_FIXTURES.totalProjects);
      repository.countActiveProjects.mockResolvedValue(EXPECTED_FROM_FIXTURES.activeProjects);

      const result = await service.getOverview({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });

      expect(result.cards.totalUsers).toBe(5);
      expect(result.cards.activeUsers.count).toBe(3);
      expect(result.cards.totalProjects).toBe(5);
      expect(result.cards.activeProjects).toBe(3);
      expect(ADMIN_STATS_FIXTURES.users).toHaveLength(5);
    });

    it('handles a month with no revenue vs prior month with revenue (edge)', async () => {
      repository.findEscrowPlatformFees.mockImplementation(async (from: Date) => {
        const month = from.getUTCMonth();
        // July only
        if (month === 6) {
          return [{ amount: 500, currency: 'ETB', at: new Date('2026-07-10T00:00:00Z') }];
        }
        return [];
      });

      const result = await service.getOverview({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });

      expect(result.cards.revenueThisMonth.amount).toBe(0);
      expect(result.cards.revenueChangeVsLastMonth.lastMonthAmount).toBe(500);
      expect(result.cards.revenueChangeVsLastMonth.percentChange).toBe(-100);
      expect(result.cards.revenueChangeVsLastMonth.direction).toBe('down');
    });

    it('computes month-over-month revenue percent change from fixtures (75%)', async () => {
      repository.findEscrowPlatformFees.mockImplementation(async (from: Date) => {
        const month = from.getUTCMonth();
        if (month === 7) {
          return ADMIN_STATS_FIXTURES.augustFees.map((r) => ({
            amount: r.amount,
            currency: r.currency,
            at: new Date(r.at),
          }));
        }
        return ADMIN_STATS_FIXTURES.julyFees.map((r) => ({
          amount: r.amount,
          currency: r.currency,
          at: new Date(r.at),
        }));
      });

      const result = await service.getOverview({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });

      expect(result.cards.revenueThisMonth.amount).toBe(
        EXPECTED_FROM_FIXTURES.revenueThisMonthAugust,
      );
      expect(result.cards.revenueChangeVsLastMonth.lastMonthAmount).toBe(
        EXPECTED_FROM_FIXTURES.revenueLastMonthJuly,
      );
      expect(result.cards.revenueChangeVsLastMonth.percentChange).toBe(
        EXPECTED_FROM_FIXTURES.momPercentChange,
      );
      expect(result.cards.revenueChangeVsLastMonth.direction).toBe('up');
      // Calculator check: (350 - 200) / 200 * 100 = 75
      expect(((350 - 200) / 200) * 100).toBe(75);
    });

    it('rejects unsupported FX currencies with 400 (does not silently keep raw amounts)', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          AdminStatsService,
          { provide: AdminStatsRepository, useValue: repository },
          {
            provide: ADMIN_STATS_CURRENCY_CONVERTER,
            useValue: {
              convertCurrency: jest.fn(() => {
                throw new BadRequestException('Exchange rate for XYZ to ETB not found');
              }),
            },
          },
          {
            provide: I18nService,
            useValue: { t: jest.fn().mockReturnValue('Dashboard Statistics') },
          },
        ],
      }).compile();
      const fxService = moduleRef.get(AdminStatsService);

      repository.findEscrowPlatformFees.mockResolvedValue([
        { amount: 100, currency: 'XYZ', at: new Date('2026-08-02T00:00:00Z') },
      ]);

      await expect(
        fxService.getOverview({
          currency: 'ETB',
          range: 'custom',
          from: '2026-08-01',
          to: '2026-08-04',
          tz: 'UTC',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks direction as new when last month was 0 and this month has revenue', async () => {
      repository.findEscrowPlatformFees.mockImplementation(async (from: Date) => {
        if (from.getUTCMonth() === 7) {
          return [{ amount: 90, currency: 'ETB', at: new Date('2026-08-02T00:00:00Z') }];
        }
        return [];
      });

      const result = await service.getOverview({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });

      expect(result.cards.revenueChangeVsLastMonth.percentChange).toBeNull();
      expect(result.cards.revenueChangeVsLastMonth.direction).toBe('new');
    });
  });

  describe('getRevenueChart', () => {
    it('zero-fills missing dates and sums platform fees', async () => {
      repository.findEscrowPlatformFees.mockResolvedValue([
        { amount: 50, currency: 'ETB', at: new Date('2026-08-02T10:00:00Z') },
      ]);

      const result = await service.getRevenueChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-03',
        tz: 'UTC',
      });

      expect(result.series).toEqual([
        { date: '2026-08-01', revenue: 0 },
        { date: '2026-08-02', revenue: 50 },
        { date: '2026-08-03', revenue: 0 },
      ]);
      expect(result.totals.revenue).toBe(50);
    });

    it('matches fixture chart Aug 1–4 including a zero-revenue day', async () => {
      repository.findEscrowPlatformFees.mockResolvedValue(
        ADMIN_STATS_FIXTURES.augustFees.map((r) => ({
          amount: r.amount,
          currency: r.currency,
          at: new Date(r.at),
        })),
      );

      const result = await service.getRevenueChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });

      expect(result.series).toEqual([...EXPECTED_FROM_FIXTURES.revenueChartAug1to4]);
      expect(result.series.find((p) => p.date === '2026-08-02')?.revenue).toBe(0);
      expect(result.totals.revenue).toBe(350);
    });

    it('includes payments and subtracts refunds in the series', async () => {
      repository.findSucceededPayments.mockResolvedValue([
        { amount: 40, currency: 'ETB', at: new Date('2026-08-01T00:00:00Z') },
      ]);
      repository.findRefundedPayments.mockResolvedValue([
        { amount: -10, currency: 'ETB', at: new Date('2026-08-01T00:00:00Z') },
      ]);

      const result = await service.getRevenueChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-01',
        tz: 'UTC',
      });

      expect(result.series[0].revenue).toBe(30);
    });
  });

  describe('getUserGrowthChart', () => {
    it('counts registrations per day with zero fill', async () => {
      repository.findUserRegistrationDates.mockResolvedValue([
        new Date('2026-08-01T08:00:00Z'),
        new Date('2026-08-01T18:00:00Z'),
      ]);
      repository.findUserLastLoginDates.mockResolvedValue([new Date('2026-08-03T09:00:00Z')]);

      const result = await service.getUserGrowthChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-03',
        tz: 'UTC',
      });

      expect(result.series).toEqual([
        { date: '2026-08-01', registrations: 2, activeUsers: 0 },
        { date: '2026-08-02', registrations: 0, activeUsers: 0 },
        { date: '2026-08-03', registrations: 0, activeUsers: 1 },
      ]);
      expect(result.activeUsersAvailable).toBe(true);
    });

    it('returns all zeros for a period with no user activity (edge)', async () => {
      const result = await service.getUserGrowthChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-02',
        tz: 'UTC',
      });

      expect(result.series).toEqual([
        { date: '2026-08-01', registrations: 0, activeUsers: 0 },
        { date: '2026-08-02', registrations: 0, activeUsers: 0 },
      ]);
      expect(result.totals.registrations).toBe(0);
    });
  });

  describe('getProjectBreakdown', () => {
    it('includes every freelance status and only owner first name', async () => {
      repository.groupProjectsByStatus.mockResolvedValue([
        { status: FreelanceJobStatus.OPEN, count: 2 },
        { status: FreelanceJobStatus.COMPLETED, count: 5 },
      ]);
      repository.findRecentProjects.mockResolvedValue([
        {
          id: 'p1',
          title: 'API work',
          status: FreelanceJobStatus.OPEN,
          budgetMin: 1000,
          budgetMax: 2000,
          currency: 'ETB',
          createdAt: new Date('2026-08-03T12:00:00Z'),
          client: { firstName: 'Abebe' },
        },
      ]);

      const result = await service.getProjectBreakdown({
        currency: 'ETB',
        range: '30d',
        tz: 'UTC',
        recentLimit: 10,
      });

      expect(result.statusSummary).toEqual(
        expect.arrayContaining([
          { status: 'DRAFT', count: 0 },
          { status: 'OPEN', count: 2 },
          { status: 'COMPLETED', count: 5 },
          { status: 'CANCELLED', count: 0 },
        ]),
      );
      expect(result.recentProjects).toEqual([
        {
          id: 'p1',
          title: 'API work',
          status: 'OPEN',
          ownerFirstName: 'Abebe',
          budgetMin: 1000,
          budgetMax: 2000,
          currency: 'ETB',
          createdAt: '2026-08-03T12:00:00.000Z',
        },
      ]);
      expect(JSON.stringify(result)).not.toMatch(/@|phone/i);
    });

    it('groups fixture projects by status exactly', async () => {
      const counts = EXPECTED_FROM_FIXTURES.statusCounts;
      repository.groupProjectsByStatus.mockResolvedValue(
        Object.entries(counts)
          .filter(([, c]) => c > 0)
          .map(([status, count]) => ({ status: status as FreelanceJobStatus, count })),
      );
      repository.findRecentProjects.mockResolvedValue(
        [...ADMIN_STATS_FIXTURES.projects]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10)
          .map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status as FreelanceJobStatus,
            budgetMin: 500,
            budgetMax: 1500,
            currency: 'ETB',
            createdAt: new Date(`${p.createdAt}T12:00:00.000Z`),
            client: { firstName: p.ownerFirstName },
          })),
      );

      const result = await service.getProjectBreakdown({
        currency: 'ETB',
        range: '30d',
        tz: 'UTC',
      });

      for (const [status, count] of Object.entries(counts)) {
        expect(result.statusSummary.find((s) => s.status === status)?.count).toBe(count);
      }
      expect(result.recentProjects[0].ownerFirstName).toBe('Abebe');
      expect(result.recentProjects[0]).not.toHaveProperty('email');
      expect(result.recentProjects[0]).not.toHaveProperty('phone');
    });
  });

  describe('CSV export', () => {
    it('exports a self-documenting revenue CSV with readable money columns', async () => {
      repository.findEscrowPlatformFees.mockResolvedValue([
        { amount: 10, currency: 'ETB', at: new Date('2026-08-01T00:00:00Z') },
      ]);
      const chart = await service.getRevenueChart({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-01',
        tz: 'UTC',
      });
      const csv = service.exportRevenueCsv(chart);
      expect(csv).toContain('Admin Stats — Revenue trend');
      expect(csv).toContain('Date,Revenue (minor units),Revenue (readable),Currency,Bucket');
      expect(csv).toContain('2026-08-01,10,0.10 ETB,ETB,Calendar day');
      expect(csv).toContain('Money unit');
      expect(csv).toContain('Period total (readable)');
    });

    it('exports overview CSV with human metric labels and descriptions', async () => {
      repository.countTotalUsers.mockResolvedValue(5);
      const overview = await service.getOverview({
        currency: 'ETB',
        range: 'custom',
        from: '2026-08-01',
        to: '2026-08-04',
        tz: 'UTC',
      });
      const csv = service.exportOverviewCsv(overview);
      expect(csv).toContain('Admin Stats — Overview snapshot');
      expect(csv).toContain('Metric,Description,Value (raw),Value (readable),Unit,Period / notes');
      expect(csv).toContain('Total users');
      expect(csv).toContain('All registered accounts on the platform');
      expect(csv).toContain('Privacy');
    });

    it('exports recent projects CSV with status labels and budget range', async () => {
      repository.findRecentProjects.mockResolvedValue([
        {
          id: 'p1',
          title: 'Logo design',
          status: 'IN_PROGRESS' as const,
          budgetMin: 1000,
          budgetMax: 2500,
          currency: 'ETB',
          createdAt: new Date('2026-08-01T12:00:00Z'),
          client: { firstName: 'Abebe' },
        },
      ]);
      repository.groupProjectsByStatus.mockResolvedValue([{ status: 'IN_PROGRESS', count: 1 }]);
      const breakdown = await service.getProjectBreakdown({
        currency: 'ETB',
        range: '30d',
        tz: 'UTC',
        recentLimit: 10,
      });
      const csv = service.exportRecentProjectsCsv(breakdown);
      expect(csv).toContain('Owner first name');
      expect(csv).toContain('In Progress');
      expect(csv).toContain('Abebe');
      expect(csv).toContain('1,000 – 2,500 ETB');
      expect(csv).not.toContain('@');
    });
  });
});

describe('AdminStatsController security wiring', () => {
  it('is guarded by JwtAuthGuard and RolesGuard at class level', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminStatsController],
      providers: [
        {
          provide: AdminStatsService,
          useValue: {
            getOverview: jest.fn(),
            getRevenueChart: jest.fn(),
            getUserGrowthChart: jest.fn(),
            getProjectBreakdown: jest.fn(),
            getDashboardStats: jest.fn(),
            exportOverviewCsv: jest.fn(),
            exportRevenueCsv: jest.fn(),
            exportUsersCsv: jest.fn(),
            exportStatusCsv: jest.fn(),
            exportRecentProjectsCsv: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = module.get(AdminStatsController);
    expect(controller).toBeDefined();

    const guards = Reflect.getMetadata('__guards__', AdminStatsController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });
});
