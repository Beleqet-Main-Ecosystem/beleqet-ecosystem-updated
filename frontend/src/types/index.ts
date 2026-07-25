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

/** Matches AuditLogRecord from audit-logging.service.ts */
export interface AuditLog {
  id: string;
  eventType: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  processedBy: string | null;
  actorUserId: string | null;
  ipAddress: string | null;
  httpMethod: string | null;
  path: string | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
  displayCurrency?: string;
  amountInDisplayCurrency?: number | null;
}

/** Paginated audit log list response */
export interface AuditLogListResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string;
  currency: string;
}

/** Query filters for the admin audit log viewer */
export interface AuditLogQuery {
  eventType?: string;
  path?: string;
  statusCode?: number | string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  lang?: string;
  currency?: string;
  httpMethod?: string;
}
