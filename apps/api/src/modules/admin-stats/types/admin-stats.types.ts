/**
 * Shared response/DTO shapes for Admin Stats (Phase 2 contract).
 */

export type StatsRangePreset = '7d' | '30d' | '12m' | 'custom';
export type StatsGranularity = 'day' | 'month';
export type RevenueChangeDirection = 'up' | 'down' | 'flat' | 'new';
export type ActiveUsersBasis = 'last_login' | 'refresh_token' | 'event_log';

export interface ResolvedStatsRange {
  preset: StatsRangePreset;
  from: string;
  to: string;
  tz: string;
  fromDate: Date;
  toDate: Date;
  granularity: StatsGranularity;
}

export interface StatsMeta {
  generatedAt: string;
  currency: string;
  amountUnit: 'minor';
  range: {
    preset: string;
    from: string;
    to: string;
    tz: string;
  };
}

export interface MoneyRow {
  amount: number;
  currency: string;
  at: Date;
}

export interface DatedCount {
  date: string;
  count: number;
}

export interface OverviewCards {
  totalUsers: number;
  activeUsers: {
    count: number;
    windowDays: number;
    basis: ActiveUsersBasis;
  };
  totalProjects: number;
  activeProjects: number;
  revenueThisMonth: {
    amount: number;
    month: string;
  };
  revenueChangeVsLastMonth: {
    thisMonthAmount: number;
    lastMonthAmount: number;
    percentChange: number | null;
    direction: RevenueChangeDirection;
  };
}

/** Richer operational snapshot — counts only, no PII. */
export interface SystemSnapshot {
  usersByRole: Array<{ role: string; count: number }>;
  inactiveUsers: number;
  unverifiedEmails: number;
  kycPending: number;
  kycApproved: number;
  employmentJobs: Array<{ status: string; count: number }>;
  contracts: Array<{ status: string; count: number }>;
  applicationsTotal: number;
  applicationsInRange: number;
  bidsTotal: number;
  bidsInRange: number;
  openDisputes: number;
  activeSubscriptions: number;
  escrow: {
    releasedCount: number;
    fundedCount: number;
    pendingCount: number;
    refundedCount: number;
    platformFeesInRange: number;
    gmvReleasedInRange: number;
  };
  payments: {
    succeededInRange: number;
    failedInRange: number;
    refundedInRange: number;
    volumeSucceededInRange: number;
  };
  revenueBreakdownThisMonth: {
    platformFees: number;
    gatewayPayments: number;
    subscriptions: number;
    refunds: number;
  };
}

export interface OverviewResponse extends StatsMeta {
  cards: OverviewCards;
  system: SystemSnapshot;
}

export interface RevenueChartResponse extends StatsMeta {
  granularity: StatsGranularity;
  series: Array<{ date: string; revenue: number }>;
  totals: { revenue: number };
  /** Per-source contribution over the same range (minor units). */
  sources: {
    platformFees: number;
    gatewayPayments: number;
    subscriptions: number;
    refunds: number;
  };
}

export interface UserGrowthChartResponse extends StatsMeta {
  granularity: StatsGranularity;
  series: Array<{ date: string; registrations: number; activeUsers: number | null }>;
  totals: { registrations: number; activeUsers: number | null };
  activeUsersAvailable: boolean;
  byRoleInRange: Array<{ role: string; count: number }>;
}

export interface ProjectBreakdownResponse extends StatsMeta {
  statusSummary: Array<{ status: string; count: number }>;
  employmentJobsSummary: Array<{ status: string; count: number }>;
  contractsSummary: Array<{ status: string; count: number }>;
  recentProjects: Array<{
    id: string;
    title: string;
    status: string;
    ownerFirstName: string;
    budgetMin: number;
    budgetMax: number;
    currency: string;
    createdAt: string;
  }>;
}

/** @deprecated Legacy flat dashboard payload */
export interface PlatformStats {
  totalUsers: number;
  totalRevenue: number;
  activeContracts: number;
  completedJobs: number;
  currency: string;
  message: string;
}
