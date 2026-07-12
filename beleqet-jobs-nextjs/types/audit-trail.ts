export enum AuditAction {
  AUTH_LOGIN = "AUTH_LOGIN",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_REGISTER = "AUTH_REGISTER",
  AUTH_EMAIL_VERIFIED = "AUTH_EMAIL_VERIFIED",
  AUTH_PASSWORD_RESET_REQUESTED = "AUTH_PASSWORD_RESET_REQUESTED",
  AUTH_PASSWORD_RESET_COMPLETED = "AUTH_PASSWORD_RESET_COMPLETED",
  PAYMENT_ESCROW_INITIATED = "PAYMENT_ESCROW_INITIATED",
  PAYMENT_ESCROW_FUNDED = "PAYMENT_ESCROW_FUNDED",
  PAYMENT_MILESTONE_RELEASED = "PAYMENT_MILESTONE_RELEASED",
  PAYMENT_WITHDRAWAL_REQUESTED = "PAYMENT_WITHDRAWAL_REQUESTED",
  PAYMENT_WITHDRAWAL_FAILED = "PAYMENT_WITHDRAWAL_FAILED",
  JOB_CREATED = "JOB_CREATED",
  JOB_UPDATED = "JOB_UPDATED",
  JOB_PUBLISHED = "JOB_PUBLISHED",
  JOB_DELETED = "JOB_DELETED",
  APPLICATION_STATUS_CHANGED = "APPLICATION_STATUS_CHANGED",
  CONTRACT_CREATED = "CONTRACT_CREATED",
  CONTRACT_COMPLETED = "CONTRACT_COMPLETED",
  CONTRACT_CANCELLED = "CONTRACT_CANCELLED",
  CONTRACT_DISPUTE_RAISED = "CONTRACT_DISPUTE_RAISED",
  BID_STATUS_CHANGED = "BID_STATUS_CHANGED",
  ADMIN_USER_UPDATED = "ADMIN_USER_UPDATED",
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  integrityHash: string;
  correlationId: string | null;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLog {
  integrityValid: boolean;
}

export interface AuditStats {
  action: string;
  count: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  fromDate?: string;
  toDate?: string;
  ipAddress?: string;
  search?: string;
}
