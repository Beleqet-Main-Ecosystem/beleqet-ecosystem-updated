import { BadRequestException, Injectable } from '@nestjs/common';
import { FreelanceJobStatus } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { WalletService } from '../wallet/wallet.service';
import { AdminStatsRepository } from './admin-stats.repository';
import { StatsQueryDto } from './dto/stats-query.dto';
import {
  MoneyRow,
  OverviewResponse,
  PlatformStats,
  ProjectBreakdownResponse,
  ResolvedStatsRange,
  RevenueChangeDirection,
  RevenueChartResponse,
  SystemSnapshot,
  UserGrowthChartResponse,
} from './types/admin-stats.types';
import { toCsv } from './utils/csv.util';
import {
  bucketKeyForDate,
  eachDayKey,
  eachMonthKey,
  monthBoundsForYmd,
  previousMonthYmd,
  resolveStatsRange,
} from './utils/date-range.util';

const ALL_PROJECT_STATUSES = Object.values(FreelanceJobStatus);

/**
 * Business logic for Admin Stats: aggregates repository data into Phase 2 contracts.
 */
@Injectable()
export class AdminStatsService {
  constructor(
    private readonly repository: AdminStatsRepository,
    private readonly walletService: WalletService,
    private readonly i18n: I18nService,
  ) {}

  async getOverview(query: StatsQueryDto): Promise<OverviewResponse> {
    const currency = this.normalizeCurrency(query.currency);
    const resolved = resolveStatsRange(query);
    const meta = this.buildMeta(currency, resolved);

    const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thisMonth = monthBoundsForYmd(resolved.to, resolved.tz);
    const lastMonthKey = previousMonthYmd(thisMonth.month);
    const lastMonth = monthBoundsForYmd(`${lastMonthKey}-15`, resolved.tz);

    const [
      totalUsers,
      activeUsersResult,
      totalProjects,
      activeProjects,
      thisMonthRevenue,
      lastMonthRevenue,
      system,
    ] = await Promise.all([
      this.repository.countTotalUsers(),
      this.repository.countActiveUsers(activeSince),
      this.repository.countTotalProjects(),
      this.repository.countActiveProjects(),
      this.sumRevenueInWindow(thisMonth.start, thisMonth.end, currency),
      this.sumRevenueInWindow(lastMonth.start, lastMonth.end, currency),
      this.buildSystemSnapshot(resolved, thisMonth, currency),
    ]);

    return {
      ...meta,
      cards: {
        totalUsers,
        activeUsers: {
          count: activeUsersResult.count,
          windowDays: 30,
          basis: activeUsersResult.basis,
        },
        totalProjects,
        activeProjects,
        revenueThisMonth: {
          amount: thisMonthRevenue,
          month: thisMonth.month,
        },
        revenueChangeVsLastMonth: this.buildRevenueChange(thisMonthRevenue, lastMonthRevenue),
      },
      system,
    };
  }

  async getRevenueChart(query: StatsQueryDto): Promise<RevenueChartResponse> {
    const currency = this.normalizeCurrency(query.currency);
    const resolved = resolveStatsRange(query);
    const meta = this.buildMeta(currency, resolved);

    const [fees, payments, refunds, subscriptions] = await Promise.all([
      this.repository.findEscrowPlatformFees(resolved.fromDate, resolved.toDate),
      this.repository.findSucceededPayments(resolved.fromDate, resolved.toDate),
      this.repository.findRefundedPayments(resolved.fromDate, resolved.toDate),
      this.repository.findSucceededSubscriptionTx(resolved.fromDate, resolved.toDate),
    ]);

    const rows = [...fees, ...payments, ...refunds, ...subscriptions];
    const seriesMap = this.zeroFilledMap(resolved);
    for (const row of rows) {
      const converted = this.safeConvert(row.amount, row.currency, currency);
      const key = bucketKeyForDate(row.at, resolved.granularity, resolved.tz);
      if (Object.prototype.hasOwnProperty.call(seriesMap, key)) {
        seriesMap[key] += converted;
      }
    }

    const series = Object.entries(seriesMap).map(([date, revenue]) => ({ date, revenue }));
    const total = series.reduce((sum, point) => sum + point.revenue, 0);
    const sumRows = (list: MoneyRow[]) =>
      list.reduce((sum, row) => sum + this.safeConvert(row.amount, row.currency, currency), 0);

    return {
      ...meta,
      granularity: resolved.granularity,
      series,
      totals: { revenue: total },
      sources: {
        platformFees: sumRows(fees),
        gatewayPayments: sumRows(payments),
        subscriptions: sumRows(subscriptions),
        refunds: sumRows(refunds),
      },
    };
  }

  async getUserGrowthChart(query: StatsQueryDto): Promise<UserGrowthChartResponse> {
    const currency = this.normalizeCurrency(query.currency);
    const resolved = resolveStatsRange(query);
    const meta = this.buildMeta(currency, resolved);

    const [registrationDates, lastLoginDates, byRoleInRange] = await Promise.all([
      this.repository.findUserRegistrationDates(resolved.fromDate, resolved.toDate),
      this.repository.findUserLastLoginDates(resolved.fromDate, resolved.toDate),
      this.repository.groupRegistrationsByRole(resolved.fromDate, resolved.toDate),
    ]);

    const registrationsMap = this.zeroFilledMap(resolved);
    const activeMap = this.zeroFilledMap(resolved);

    for (const at of registrationDates) {
      const key = bucketKeyForDate(at, resolved.granularity, resolved.tz);
      if (Object.prototype.hasOwnProperty.call(registrationsMap, key)) {
        registrationsMap[key] += 1;
      }
    }

    for (const at of lastLoginDates) {
      const key = bucketKeyForDate(at, resolved.granularity, resolved.tz);
      if (Object.prototype.hasOwnProperty.call(activeMap, key)) {
        activeMap[key] += 1;
      }
    }

    const keys = Object.keys(registrationsMap);
    const series = keys.map((date) => ({
      date,
      registrations: registrationsMap[date],
      activeUsers: activeMap[date],
    }));

    const registrationsTotal = series.reduce((sum, p) => sum + p.registrations, 0);
    const activeTotal = series.reduce((sum, p) => sum + (p.activeUsers ?? 0), 0);

    return {
      ...meta,
      granularity: resolved.granularity,
      series,
      totals: { registrations: registrationsTotal, activeUsers: activeTotal },
      activeUsersAvailable: true,
      byRoleInRange,
    };
  }

  async getProjectBreakdown(query: StatsQueryDto): Promise<ProjectBreakdownResponse> {
    const currency = this.normalizeCurrency(query.currency);
    const resolved = resolveStatsRange(query);
    const meta = this.buildMeta(currency, resolved);
    const limit = query.recentLimit ?? 10;

    const applyRange = query.applyRangeToProjects === true;
    const [grouped, employmentJobs, contracts, recent] = await Promise.all([
      this.repository.groupProjectsByStatus(),
      this.repository.groupEmploymentJobsByStatus(),
      this.repository.groupContractsByStatus(),
      this.repository.findRecentProjects(
        limit,
        applyRange ? resolved.fromDate : undefined,
        applyRange ? resolved.toDate : undefined,
      ),
    ]);

    const countByStatus = new Map(grouped.map((g) => [g.status, g.count]));
    const statusSummary = ALL_PROJECT_STATUSES.map((status) => ({
      status,
      count: countByStatus.get(status) ?? 0,
    }));

    return {
      ...meta,
      statusSummary,
      employmentJobsSummary: employmentJobs,
      contractsSummary: contracts,
      recentProjects: recent.map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        ownerFirstName: project.client.firstName,
        budgetMin: project.budgetMin,
        budgetMax: project.budgetMax,
        currency: project.currency,
        createdAt: project.createdAt.toISOString(),
      })),
    };
  }

  /** @deprecated Prefer getOverview / chart endpoints. */
  async getDashboardStats(query: StatsQueryDto): Promise<PlatformStats> {
    const currency = this.normalizeCurrency(query.currency);
    const lang = query.lang || 'en';

    const [totalUsers, activeContracts, completedJobs, overview] = await Promise.all([
      this.repository.countTotalUsers(),
      this.repository.countActiveContracts(),
      this.repository.countCompletedFreelanceJobs(),
      this.getOverview({ ...query, currency }),
    ]);

    const translatedMessage = this.i18n.t('admin-stats.DASHBOARD_TITLE', {
      lang,
      defaultValue: 'Dashboard Statistics',
    });

    return {
      totalUsers,
      totalRevenue: overview.cards.revenueThisMonth.amount,
      activeContracts,
      completedJobs,
      currency,
      message: typeof translatedMessage === 'string' ? translatedMessage : 'Dashboard Statistics',
    };
  }

  exportOverviewCsv(overview: OverviewResponse): string {
    const c = overview.cards;
    const s = overview.system;
    return toCsv(
      ['metric', 'value', 'unit', 'month_or_window'],
      [
        ['totalUsers', c.totalUsers, 'count', 'all_time'],
        ['activeUsers', c.activeUsers.count, 'count', `${c.activeUsers.windowDays}d`],
        ['totalProjects', c.totalProjects, 'count', 'all_time'],
        ['activeProjects', c.activeProjects, 'count', 'not_completed_cancelled'],
        ['revenueThisMonth', c.revenueThisMonth.amount, overview.currency, c.revenueThisMonth.month],
        [
          'revenueChangePercent',
          c.revenueChangeVsLastMonth.percentChange ?? '',
          'percent',
          c.revenueChangeVsLastMonth.direction,
        ],
        ['openDisputes', s.openDisputes, 'count', 'open'],
        ['activeSubscriptions', s.activeSubscriptions, 'count', 'active'],
        ['applicationsInRange', s.applicationsInRange, 'count', 'range'],
        ['bidsInRange', s.bidsInRange, 'count', 'range'],
        ['gmvReleasedInRange', s.escrow.gmvReleasedInRange, overview.currency, 'range'],
        ['platformFeesInRange', s.escrow.platformFeesInRange, overview.currency, 'range'],
      ],
    );
  }

  exportRevenueCsv(chart: RevenueChartResponse): string {
    return toCsv(
      ['date', 'revenue', 'currency'],
      chart.series.map((p) => [p.date, p.revenue, chart.currency]),
    );
  }

  exportUsersCsv(chart: UserGrowthChartResponse): string {
    return toCsv(
      ['date', 'registrations', 'active_users'],
      chart.series.map((p) => [p.date, p.registrations, p.activeUsers]),
    );
  }

  exportStatusCsv(breakdown: ProjectBreakdownResponse): string {
    return toCsv(
      ['status', 'count'],
      breakdown.statusSummary.map((s) => [s.status, s.count]),
    );
  }

  exportRecentProjectsCsv(breakdown: ProjectBreakdownResponse): string {
    return toCsv(
      ['id', 'title', 'status', 'owner_first_name', 'budget_min', 'budget_max', 'currency', 'created_at'],
      breakdown.recentProjects.map((p) => [
        p.id,
        p.title,
        p.status,
        p.ownerFirstName,
        p.budgetMin,
        p.budgetMax,
        p.currency,
        p.createdAt,
      ]),
    );
  }

  private async buildSystemSnapshot(
    resolved: ResolvedStatsRange,
    thisMonth: { start: Date; end: Date; month: string },
    currency: string,
  ): Promise<SystemSnapshot> {
    const [
      usersByRole,
      inactiveUsers,
      unverifiedEmails,
      kycPending,
      kycApproved,
      employmentJobs,
      contracts,
      applicationsTotal,
      applicationsInRange,
      bidsTotal,
      bidsInRange,
      openDisputes,
      activeSubscriptions,
      releasedCount,
      fundedCount,
      pendingCount,
      refundedCount,
      fees,
      gmvRows,
      paymentsSucceeded,
      paymentsFailed,
      paymentsRefunded,
      paymentVolume,
      monthFees,
      monthPayments,
      monthSubs,
      monthRefunds,
    ] = await Promise.all([
      this.repository.groupUsersByRole(),
      this.repository.countInactiveUsers(),
      this.repository.countUnverifiedEmails(),
      this.repository.countKycByStatus('PENDING'),
      this.repository.countKycByStatus('APPROVED'),
      this.repository.groupEmploymentJobsByStatus(),
      this.repository.groupContractsByStatus(),
      this.repository.countApplications(),
      this.repository.countApplications(resolved.fromDate, resolved.toDate),
      this.repository.countBids(),
      this.repository.countBids(resolved.fromDate, resolved.toDate),
      this.repository.countOpenDisputes(),
      this.repository.countActiveSubscriptions(),
      this.repository.countEscrowByStatus('RELEASED'),
      this.repository.countEscrowByStatus('FUNDED'),
      this.repository.countEscrowByStatus('PENDING'),
      this.repository.countEscrowByStatus('REFUNDED'),
      this.repository.findEscrowPlatformFees(resolved.fromDate, resolved.toDate),
      this.repository.sumEscrowGrossReleased(resolved.fromDate, resolved.toDate),
      this.repository.countPaymentsByStatus('SUCCEEDED' as never, resolved.fromDate, resolved.toDate),
      this.repository.countPaymentsByStatus('FAILED' as never, resolved.fromDate, resolved.toDate),
      this.repository.countPaymentsByStatus('REFUNDED' as never, resolved.fromDate, resolved.toDate),
      this.repository.findSucceededPayments(resolved.fromDate, resolved.toDate),
      this.repository.findEscrowPlatformFees(thisMonth.start, thisMonth.end),
      this.repository.findSucceededPayments(thisMonth.start, thisMonth.end),
      this.repository.findSucceededSubscriptionTx(thisMonth.start, thisMonth.end),
      this.repository.findRefundedPayments(thisMonth.start, thisMonth.end),
    ]);

    const sum = (rows: MoneyRow[]) =>
      rows.reduce((acc, row) => acc + this.safeConvert(row.amount, row.currency, currency), 0);

    return {
      usersByRole,
      inactiveUsers,
      unverifiedEmails,
      kycPending,
      kycApproved,
      employmentJobs,
      contracts,
      applicationsTotal,
      applicationsInRange,
      bidsTotal,
      bidsInRange,
      openDisputes,
      activeSubscriptions,
      escrow: {
        releasedCount,
        fundedCount,
        pendingCount,
        refundedCount,
        platformFeesInRange: sum(fees),
        gmvReleasedInRange: sum(gmvRows),
      },
      payments: {
        succeededInRange: paymentsSucceeded,
        failedInRange: paymentsFailed,
        refundedInRange: paymentsRefunded,
        volumeSucceededInRange: sum(paymentVolume),
      },
      revenueBreakdownThisMonth: {
        platformFees: sum(monthFees),
        gatewayPayments: sum(monthPayments),
        subscriptions: sum(monthSubs),
        refunds: sum(monthRefunds),
      },
    };
  }

  private async sumRevenueInWindow(from: Date, to: Date, currency: string): Promise<number> {
    const rows = await this.collectRevenueRows(from, to);
    return rows.reduce((sum, row) => sum + this.safeConvert(row.amount, row.currency, currency), 0);
  }

  private async collectRevenueRows(from: Date, to: Date): Promise<MoneyRow[]> {
    const [fees, payments, refunds, subscriptions] = await Promise.all([
      this.repository.findEscrowPlatformFees(from, to),
      this.repository.findSucceededPayments(from, to),
      this.repository.findRefundedPayments(from, to),
      this.repository.findSucceededSubscriptionTx(from, to),
    ]);
    return [...fees, ...payments, ...refunds, ...subscriptions];
  }

  private zeroFilledMap(resolved: ResolvedStatsRange): Record<string, number> {
    const keys =
      resolved.granularity === 'month'
        ? eachMonthKey(resolved.from, resolved.to)
        : eachDayKey(resolved.from, resolved.to, resolved.tz);
    return Object.fromEntries(keys.map((key) => [key, 0]));
  }

  private buildRevenueChange(
    thisMonthAmount: number,
    lastMonthAmount: number,
  ): {
    thisMonthAmount: number;
    lastMonthAmount: number;
    percentChange: number | null;
    direction: RevenueChangeDirection;
  } {
    if (lastMonthAmount === 0) {
      return {
        thisMonthAmount,
        lastMonthAmount,
        percentChange: null,
        direction: thisMonthAmount > 0 ? 'new' : 'flat',
      };
    }
    const percentChange = Number(
      (((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100).toFixed(2),
    );
    let direction: RevenueChangeDirection = 'flat';
    if (percentChange > 0) direction = 'up';
    else if (percentChange < 0) direction = 'down';
    return { thisMonthAmount, lastMonthAmount, percentChange, direction };
  }

  private buildMeta(currency: string, resolved: ResolvedStatsRange) {
    return {
      generatedAt: new Date().toISOString(),
      currency,
      amountUnit: 'minor' as const,
      range: {
        preset: resolved.preset,
        from: resolved.from,
        to: resolved.to,
        tz: resolved.tz,
      },
    };
  }

  private normalizeCurrency(currency?: string): string {
    const value = (currency || 'ETB').toUpperCase();
    if (!/^[A-Z]{3}$/.test(value)) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    return value;
  }

  private safeConvert(amount: number, from: string, to: string): number {
    try {
      return this.walletService.convertCurrency(amount, from || 'ETB', to);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Unable to convert ${from || 'ETB'} to ${to} for admin stats revenue`,
      );
    }
  }
}
