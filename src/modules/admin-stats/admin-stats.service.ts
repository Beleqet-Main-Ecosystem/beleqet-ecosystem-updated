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
import { toCsvDocument, formatMinorForCsv, formatStatusLabel } from './utils/csv.util';
import {
  bucketKeyForDate,
  eachDayKey,
  eachMonthKey,
  monthBoundsForYmd,
  previousMonthYmd,
  resolveStatsRange,
} from './utils/date-range.util';

const ALL_PROJECT_STATUSES = Object.values(FreelanceJobStatus);

function csvRangeMeta(meta: {
  generatedAt: string;
  currency: string;
  amountUnit: string;
  range: { preset: string; from: string; to: string; tz: string };
}): Array<[string, string]> {
  return [
    ['Generated at (UTC)', meta.generatedAt],
    ['Date range preset', meta.range.preset],
    ['Date range from', meta.range.from],
    ['Date range to', meta.range.to],
    ['Timezone', meta.range.tz],
    ['Currency', meta.currency],
    [
      'Money unit',
      meta.amountUnit === 'minor'
        ? `minor units (divide by 100 for ${meta.currency} major amount)`
        : meta.amountUnit,
    ],
    ['Privacy', 'No emails or phone numbers — owner first name only where applicable'],
  ];
}

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
    const currency = overview.currency;
    const mom = c.revenueChangeVsLastMonth;
    const momDisplay =
      mom.percentChange === null
        ? mom.direction === 'new'
          ? 'New (no prior month revenue)'
          : '—'
        : `${mom.direction === 'up' ? '↑' : mom.direction === 'down' ? '↓' : ''}${mom.percentChange > 0 ? '+' : ''}${mom.percentChange}% (${mom.direction})`;

    return toCsvDocument({
      title: 'Admin Stats — Overview snapshot',
      meta: csvRangeMeta(overview),
      headers: [
        'Metric',
        'Description',
        'Value (raw)',
        'Value (readable)',
        'Unit',
        'Period / notes',
      ],
      rows: [
        [
          'Total users',
          'All registered accounts on the platform',
          c.totalUsers,
          c.totalUsers.toLocaleString('en-US'),
          'count',
          'All time',
        ],
        [
          'Active users',
          `Users with a successful session in the last ${c.activeUsers.windowDays} days (basis: ${c.activeUsers.basis.replace(/_/g, ' ')})`,
          c.activeUsers.count,
          c.activeUsers.count.toLocaleString('en-US'),
          'count',
          `Rolling ${c.activeUsers.windowDays} days`,
        ],
        [
          'Total projects',
          'All freelance jobs (projects)',
          c.totalProjects,
          c.totalProjects.toLocaleString('en-US'),
          'count',
          'All time',
        ],
        [
          'Active projects',
          'Freelance jobs not completed or cancelled',
          c.activeProjects,
          c.activeProjects.toLocaleString('en-US'),
          'count',
          'Statuses: Draft, Funded, Open, In progress',
        ],
        [
          'Revenue this month',
          'Platform income (fees + payments + subscriptions − refunds) for the calendar month',
          c.revenueThisMonth.amount,
          formatMinorForCsv(c.revenueThisMonth.amount, currency),
          `${currency} (minor)`,
          c.revenueThisMonth.month,
        ],
        [
          'Revenue vs last month',
          'Percent change vs previous calendar month',
          mom.percentChange ?? '',
          momDisplay,
          'percent',
          `This month ${formatMinorForCsv(mom.thisMonthAmount, currency)} · last month ${formatMinorForCsv(mom.lastMonthAmount, currency)}`,
        ],
        [
          'Open disputes',
          'Disputes still open',
          s.openDisputes,
          s.openDisputes.toLocaleString('en-US'),
          'count',
          'Current',
        ],
        [
          'Active subscriptions',
          'Subscriptions currently active',
          s.activeSubscriptions,
          s.activeSubscriptions.toLocaleString('en-US'),
          'count',
          'Current',
        ],
        [
          'Applications in range',
          'Job applications created in the selected date range',
          s.applicationsInRange,
          s.applicationsInRange.toLocaleString('en-US'),
          'count',
          `${overview.range.from} → ${overview.range.to}`,
        ],
        [
          'Bids in range',
          'Freelance bids created in the selected date range',
          s.bidsInRange,
          s.bidsInRange.toLocaleString('en-US'),
          'count',
          `${overview.range.from} → ${overview.range.to}`,
        ],
        [
          'GMV released in range',
          'Gross merchandise value released from escrow in range',
          s.escrow.gmvReleasedInRange,
          formatMinorForCsv(s.escrow.gmvReleasedInRange, currency),
          `${currency} (minor)`,
          `${overview.range.from} → ${overview.range.to}`,
        ],
        [
          'Platform fees in range',
          'Escrow platform fees recognized in range',
          s.escrow.platformFeesInRange,
          formatMinorForCsv(s.escrow.platformFeesInRange, currency),
          `${currency} (minor)`,
          `${overview.range.from} → ${overview.range.to}`,
        ],
        [
          'Revenue mix — platform fees (this month)',
          'Escrow platform fees in the revenue month',
          s.revenueBreakdownThisMonth.platformFees,
          formatMinorForCsv(s.revenueBreakdownThisMonth.platformFees, currency),
          `${currency} (minor)`,
          c.revenueThisMonth.month,
        ],
        [
          'Revenue mix — gateway payments (this month)',
          'Succeeded gateway payments in the revenue month',
          s.revenueBreakdownThisMonth.gatewayPayments,
          formatMinorForCsv(s.revenueBreakdownThisMonth.gatewayPayments, currency),
          `${currency} (minor)`,
          c.revenueThisMonth.month,
        ],
        [
          'Revenue mix — subscriptions (this month)',
          'Succeeded subscription charges in the revenue month',
          s.revenueBreakdownThisMonth.subscriptions,
          formatMinorForCsv(s.revenueBreakdownThisMonth.subscriptions, currency),
          `${currency} (minor)`,
          c.revenueThisMonth.month,
        ],
        [
          'Revenue mix — refunds (this month)',
          'Refunded payment amounts in the revenue month (subtracted from total)',
          s.revenueBreakdownThisMonth.refunds,
          formatMinorForCsv(s.revenueBreakdownThisMonth.refunds, currency),
          `${currency} (minor)`,
          c.revenueThisMonth.month,
        ],
      ],
      notes: [
        'Readable money columns show major units (÷ 100). Raw columns keep API minor units for reconciliation.',
        'Projects = freelance jobs only (not employment Job listings).',
      ],
    });
  }

  exportRevenueCsv(chart: RevenueChartResponse): string {
    const totalReadable = formatMinorForCsv(chart.totals.revenue, chart.currency);
    return toCsvDocument({
      title: 'Admin Stats — Revenue trend',
      meta: [
        ...csvRangeMeta(chart),
        ['Granularity', chart.granularity === 'day' ? 'Daily' : 'Monthly'],
        ['Period total (raw minor)', chart.totals.revenue],
        ['Period total (readable)', totalReadable],
        ['Source — platform fees (minor)', chart.sources.platformFees],
        ['Source — gateway payments (minor)', chart.sources.gatewayPayments],
        ['Source — subscriptions (minor)', chart.sources.subscriptions],
        ['Source — refunds (minor)', chart.sources.refunds],
      ],
      headers: [
        'Date',
        'Revenue (minor units)',
        'Revenue (readable)',
        'Currency',
        'Bucket',
      ],
      rows: chart.series.map((p) => [
        p.date,
        p.revenue,
        formatMinorForCsv(p.revenue, chart.currency),
        chart.currency,
        chart.granularity === 'day' ? 'Calendar day' : 'Calendar month',
      ]),
      notes: [
        'Missing days/months are filled with 0 so the series is continuous.',
        'Revenue = platform fees + gateway payments + subscriptions − refunds, converted to the selected currency.',
      ],
    });
  }

  exportUsersCsv(chart: UserGrowthChartResponse): string {
    return toCsvDocument({
      title: 'Admin Stats — User growth',
      meta: [
        ...csvRangeMeta(chart),
        ['Granularity', chart.granularity === 'day' ? 'Daily' : 'Monthly'],
        ['Total new registrations', chart.totals.registrations],
        [
          'Active users available',
          chart.activeUsersAvailable ? 'Yes' : 'No (column may be empty)',
        ],
        [
          'Total active-user observations',
          chart.totals.activeUsers === null ? 'n/a' : chart.totals.activeUsers,
        ],
      ],
      headers: [
        'Date',
        'New registrations',
        'Active users',
        'Active users note',
        'Bucket',
      ],
      rows: chart.series.map((p) => [
        p.date,
        p.registrations,
        p.activeUsers ?? '',
        chart.activeUsersAvailable
          ? p.activeUsers === null
            ? 'Unavailable for this bucket'
            : 'Users with login activity in this bucket'
          : 'Active-user tracking not available',
        chart.granularity === 'day' ? 'Calendar day' : 'Calendar month',
      ]),
      notes: [
        'Registrations = users createdAt in the bucket.',
        'Active users = distinct users with lastLoginAt in the bucket when tracking is available.',
      ],
    });
  }

  exportStatusCsv(breakdown: ProjectBreakdownResponse): string {
    const total = breakdown.statusSummary.reduce((sum, row) => sum + row.count, 0);
    return toCsvDocument({
      title: 'Admin Stats — Freelance projects by status',
      meta: [
        ...csvRangeMeta(breakdown),
        ['Total projects in summary', total],
        [
          'Range applied to status counts',
          'No — status summary is all-time unless applyRangeToProjects=true was requested',
        ],
      ],
      headers: ['Status code', 'Status label', 'Count', 'Share of total (%)'],
      rows: breakdown.statusSummary.map((s) => [
        s.status,
        formatStatusLabel(s.status),
        s.count,
        total === 0 ? '0.00' : ((s.count / total) * 100).toFixed(2),
      ]),
      notes: [
        'Every freelance job status appears even when count is 0.',
        'Projects = FreelanceJob records only.',
      ],
    });
  }

  exportRecentProjectsCsv(breakdown: ProjectBreakdownResponse): string {
    return toCsvDocument({
      title: 'Admin Stats — Recent freelance projects',
      meta: [
        ...csvRangeMeta(breakdown),
        ['Rows exported', breakdown.recentProjects.length],
        ['GDPR note', 'Owner column is first name only — no email, phone, or last name'],
      ],
      headers: [
        'Project ID',
        'Project title',
        'Status code',
        'Status label',
        'Owner first name',
        'Budget min',
        'Budget max',
        'Budget currency',
        'Budget range (readable)',
        'Created at (ISO)',
      ],
      rows: breakdown.recentProjects.map((p) => [
        p.id,
        p.title,
        p.status,
        formatStatusLabel(p.status),
        p.ownerFirstName,
        p.budgetMin,
        p.budgetMax,
        p.currency,
        `${p.budgetMin.toLocaleString('en-US')} – ${p.budgetMax.toLocaleString('en-US')} ${p.currency}`,
        p.createdAt,
      ]),
      notes: [
        'Budget min/max are the values stored on the freelance job (major currency units as entered by the client).',
        'Sorted by created date, newest first.',
      ],
    });
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
