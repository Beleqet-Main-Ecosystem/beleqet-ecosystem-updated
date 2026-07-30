import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log_event_type';

/**
 * Marks a controller method as auditable. When applied, `AuditInterceptor`
 * automatically records a `events_log` entry after the handler completes
 * successfully, using the current authenticated user as the actor and
 * `eventType` as the recorded event type.
 *
 * @example
 * ```ts
 * @Post('login')
 * @AuditLog('USER_LOGIN')
 * login(@Body() dto: LoginDto) { ... }
 * ```
 */
export const AuditLog = (eventType: string) => SetMetadata(AUDIT_LOG_KEY, eventType);
