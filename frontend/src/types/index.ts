import type { ReactNode } from 'react';

/**
 * Centralized TypeScript types matching the NestJS backend response shapes.
 * Mirrors the PlatformStats interface and Prisma Dispute model.
 */

/** Matches PlatformStats from admin-stats.service.ts */
export interface PlatformStats {
  totalUsers: number;
  totalRevenue: number;
  activeContracts: number;
  completedJobs: number;
  currency: string;
  message: string;
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
  color: string;
}

/** A single immutable audit trail entry (mirrors the backend's `events_log` / EventLog model). */
/** Matches AuditLogRecord from audit-logging.service.ts */
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

/** Analytics summary for a single campaign, as returned by GET /promoted-engine/campaigns/:id/analytics. */
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
  actorUserId: string | null;
  ipAddress: string | null;
  httpMethod: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  displayCurrency?: string;
  amountInDisplayCurrency?: number | null;
/** Paginated audit log list response */
export interface AuditLogListResponse {
  data: AuditLog[];
  meta: {
  };
  message: string;
/** Query filters for the admin audit log viewer */
export interface AuditLogQuery {
  path?: string;
  statusCode?: number | string;
  search?: string;
  from?: string;
  to?: string;
  lang?: string;
  currency?: string;
  httpMethod?: string;
