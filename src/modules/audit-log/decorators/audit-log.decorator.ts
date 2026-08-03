import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'AUDIT_ACTION_KEY';

export interface AuditActionOptions {
  action: string;
  entity: string;
}

/**
 * Decorator to configure audit metadata on NestJS controller methods.
 *
 * @param options - Audit action and entity definition
 * @example
 * ```ts
 * @AuditAction({ action: 'CREATE_JOB', entity: 'Job' })
 * ```
 */
export const AuditAction = (options: AuditActionOptions) => SetMetadata(AUDIT_ACTION_KEY, options);
