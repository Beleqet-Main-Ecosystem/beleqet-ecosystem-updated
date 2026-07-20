import { GdprUtil } from '../interfaces/gdpr.interface';

/**
 * GDPR-aware sanitizer for audit log payloads.
 *
 * Two layers of protection before anything is persisted to the immutable
 * audit trail:
 *  1. Known-sensitive keys (passwords, tokens, secrets) are fully redacted.
 *  2. Any remaining string values are passed through the existing
 *     `GdprUtil.maskPII` utility, which masks emails/phone numbers that
 *     might appear inside free-text fields (e.g. a dispute reason).
 *
 * Recurses one level into nested plain objects, which covers the common
 * `{ before, after }` shape used for data-modification audit events.
 */
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'ssn',
  'cardNumber',
  'cvv',
] as const;

export function sanitizePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const isSensitiveKey = SENSITIVE_KEYS.some((k) =>
      key.toLowerCase().includes(k.toLowerCase()),
    );

    if (isSensitiveKey) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      clean[key] = GdprUtil.maskPII(value);
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      clean[key] = sanitizePayload(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}
