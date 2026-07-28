export interface IAuditLogger {
    log(eventType: string, entityId: string, payload: Record<string, unknown>): Promise<void>;
}
export declare const AUDIT_LOGGER: unique symbol;
