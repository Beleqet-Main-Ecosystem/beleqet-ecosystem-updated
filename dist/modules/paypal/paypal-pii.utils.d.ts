export declare const GDPR_REDACTED = "[GDPR_REDACTED]";
export declare function hashPii(value: string): string;
export declare function maskPayerPii(payload: unknown): unknown;
export declare function sanitiseForStorage(response: unknown): object;
