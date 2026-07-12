import { SetMetadata } from '@nestjs/common';
import { AuditAction } from './audit-action.enum';

/** Reflector metadata key used by `AuditInterceptor` to read audit configuration. */
export const AUDIT_METADATA_KEY = 'audit:metadata';

/** Metadata shape stored by the `@Audit()` decorator. */
export interface AuditMetadata {
  action: AuditAction;
  entityType: string;
  /**
   * Optional dot-path into the Express `request` object used to extract the
   * entity ID. Defaults to `request.params.id` when omitted.
   * Example: `'params.jobId'`
   */
  entityIdPath?: string;
}

/**
 * Annotates a controller method so that `AuditInterceptor` writes an audit
 * log entry after the handler resolves.
 *
 * @param action       - The action constant for this operation.
 * @param entityType   - The domain entity class being affected.
 * @param entityIdPath - Optional dot-path to the entity ID within `request`.
 *
 * @example
 * \@Audit(AuditAction.JOB_CREATED, 'Job')
 * create(@Body() dto: CreateJobDto) { ... }
 */
export const Audit = (
  action: AuditAction,
  entityType: string,
  entityIdPath?: string,
): MethodDecorator => SetMetadata(AUDIT_METADATA_KEY, { action, entityType, entityIdPath });
