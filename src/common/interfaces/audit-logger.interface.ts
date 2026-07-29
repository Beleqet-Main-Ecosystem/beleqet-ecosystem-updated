/**
 * Abstraction over audit-event persistence, backed by the existing
 * `EventLog` table. Kept as an interface so AccountLinkingService's
 * tests don't need a real DB — see its .spec.ts for the mock.
 */
export interface IAuditLogger {
  log(eventType: string, entityId: string, payload: Record<string, unknown>): Promise<void>;
}

export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');
