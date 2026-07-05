import { AuditLog } from '@prisma/client';

/**
 * Extends the Prisma `AuditLog` model with a runtime integrity check result.
 * `integrityValid` is false when the recomputed hash does not match the stored one.
 */
export interface AuditLogDetailDto extends AuditLog {
  integrityValid: boolean;
}

/**
 * Generic pagination envelope returned by paginated list endpoints.
 * @typeParam T - The type of each data item in the result set.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  /** Derived: `Math.ceil(total / limit)`. */
  totalPages: number;
}

/** Aggregate count of audit log entries for a single action type. */
export interface AuditStatsDto {
  action: string;
  count: number;
}
