import type { ReactNode } from 'react';

/**
 * Centralized TypeScript types matching the NestJS backend response shapes.
 */

/** @deprecated Legacy flat dashboard — prefer OverviewResponse */
export interface PlatformStats {
  totalUsers: number;
  totalRevenue: number;
  activeContracts: number;
  completedJobs: number;
  currency: string;
  message: string;
}

export type StatsRangePreset = '7d' | '30d' | '12m' | 'custom';

export interface StatsQueryParams {
  currency?: string;
  lang?: string;
  range?: StatsRangePreset;
  from?: string;
  to?: string;
  tz?: string;
  recentLimit?: number;
  applyRangeToProjects?: boolean;
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

export interface OverviewResponse extends StatsMeta {
  cards: {
    totalUsers: number;
    activeUsers: {
      count: number;
      windowDays: number;
      basis: 'last_login' | 'refresh_token' | 'event_log';
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
      direction: 'up' | 'down' | 'flat' | 'new';
    };
  };
  system: {
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
  };
}

export interface RevenueChartResponse extends StatsMeta {
  granularity: 'day' | 'month';
  series: Array<{ date: string; revenue: number }>;
  totals: { revenue: number };
  sources: {
    platformFees: number;
    gatewayPayments: number;
    subscriptions: number;
    refunds: number;
  };
}

export interface UserGrowthChartResponse extends StatsMeta {
  granularity: 'day' | 'month';
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

/** Matches Prisma Dispute model + contract relation from dispute-manager.service.ts */
export interface Dispute {
  id: string;
  contractId: string;
  raisedById: string;
  reason: string;
  evidenceUrls: string[];
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: {
    id: string;
    status: string;
    agreedAmount: number;
    currency: string;
  };
}

/** Auth login response shape */
export interface AuthResponse {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

/** Stat card shape used in the dashboard */
export interface StatCardData {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** Soft icon well background */
  color: string;
  /** Icon stroke/fill color for contrast on the well */
  iconColor?: string;
  hint?: string;
  delta?: {
    text: string;
    tone: 'up' | 'down' | 'flat' | 'new';
  };
}

/** A single immutable audit trail entry (mirrors the backend's `events_log` / EventLog model). */
export interface AuditLog {
  id: string;
  eventType: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  processedBy: string | null;
  createdAt: string;
}

/** Paginated response shape returned by GET /audit-logs. */
export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Filters accepted by GET /audit-logs. */
export interface AuditLogFilters {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/** Notification item from the backend */
export interface Notification {
  id: string;
  userId: string;
  channel: 'IN_APP' | 'EMAIL' | 'TELEGRAM' | 'PUSH' | 'SMS';
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Notification channel */
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'TELEGRAM' | 'PUSH' | 'SMS';

/** Notification preference settings */
export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  telegramEnabled: boolean;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  language: string;
  createdAt: string;
  updatedAt: string;
}

/** User-selected colour-scheme preference. `SYSTEM` delegates to the OS. */
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

/** API response shape for the persisted user theme setting. */
export interface ThemePreferenceResponse {
  theme: ThemePreference;
}

/** A single promotion campaign, as returned by the Promoted Engine API. */
export interface PromotionCampaign {
  id: string;
  ownerId: string;
  targetType: 'JOB' | 'PROPOSAL' | 'GIG';
  targetId: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'COMPLETED' | 'CANCELLED';
  cpcBid: number;
  dailyBudget: number;
  totalBudget: number | null;
  currency: string;
  spentToday: number;
  spentTotal: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Analytics summary for a single campaign. */
export interface CampaignAnalytics {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  spentTotal: number;
  spentToday: number;
  currency: string;
  status: string;
}
