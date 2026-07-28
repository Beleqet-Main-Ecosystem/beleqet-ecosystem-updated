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
 * Recurses into nested plain objects (covering the common `{ before, after }`
 * data-modification shape) AND into arrays, sanitizing each element in turn —
 * so an array of objects (e.g. `[{ password: 'secret' }]`) is not passed
 * through untouched.
 *
 * `Date` instances are passed through as-is rather than recursed into:
 * `typeof date === 'object'` is true, but `Object.entries(date)` is always
 * empty (a Date's value lives in an internal slot, not enumerable own
 * properties), so recursing into one would silently collapse it to `{}`.
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

/** Sanitizes a single value: string, Date, array, nested object, or primitive. */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return GdprUtil.maskPII(value);
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return sanitizePayload(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    const isSensitiveKey = SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()));

    clean[key] = isSensitiveKey ? '[REDACTED]' : sanitizeValue(value);
  }

  return clean;
}
