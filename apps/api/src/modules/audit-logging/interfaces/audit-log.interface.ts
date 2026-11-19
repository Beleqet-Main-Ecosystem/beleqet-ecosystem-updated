/**
 * Shared contracts for the platform-wide audit logging writer.
 */

/** Shape accepted when persisting a domain or HTTP audit event. */
export interface CreateAuditLogInput {
  eventType: string;
  entityId: string;
  entityType: string;
  payload?: Record<string, unknown>;
  processedBy?: string;
  actorUserId?: string;
  ipAddress?: string;
  httpMethod?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
}

/** Serialized audit log row returned to admin clients. */
export interface AuditLogRecord {
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
  createdAt: Date;
  /** Optional monetary display metadata for multi-currency UIs. */
  displayCurrency?: string;
  amountInDisplayCurrency?: number | null;
}

/** Paginated list response for the admin log viewer. */
export interface AuditLogListResponse {
  data: AuditLogRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message: string;
  currency: string;
}

/** DI token for the unified audit logger. */
export const AUDIT_LOGGING_SERVICE = Symbol('AUDIT_LOGGING_SERVICE');
