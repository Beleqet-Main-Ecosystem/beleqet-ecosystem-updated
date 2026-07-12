import { AuditAction } from '../audit-action.enum';

/**
 * Data required to create a new audit log entry.
 *
 * All fields except `action` and `entityType` are optional to support both
 * HTTP-interceptor-driven logging and programmatic logging from queue processors.
 */
export interface CreateAuditLogDto {
  /** UUID of the user who performed the action. Null for system-initiated actions. */
  actorId?: string;
  /**
   * Email of the actor at the time of the action.
   * For password-reset events this must be pre-masked (first 3 chars + `***` + `@domain`).
   */
  actorEmail?: string;
  /** Role of the actor at the time of the action (e.g. `'ADMIN'`, `'FREELANCER'`). */
  actorRole?: string;
  /** The categorised action label. */
  action: AuditAction;
  /** Domain entity class affected (e.g. `'User'`, `'Contract'`, `'EscrowTransaction'`). */
  entityType: string;
  /** Primary key of the affected entity instance. */
  entityId?: string;
  /** Client IP address extracted from `x-forwarded-for` or `request.ip`. */
  ipAddress?: string;
  /** Full User-Agent string from the originating HTTP request. */
  userAgent?: string;
  /**
   * Arbitrary structured context for this action.
   * Must not contain raw passwords, JWT tokens, or payment account numbers.
   * Payloads exceeding 64 KB will be truncated.
   */
  metadata?: Record<string, unknown>;
  /**
   * Correlation ID for distributed request tracing.
   * Sourced from `x-correlation-id` header or generated via `uuid()`.
   */
  correlationId?: string;
}
