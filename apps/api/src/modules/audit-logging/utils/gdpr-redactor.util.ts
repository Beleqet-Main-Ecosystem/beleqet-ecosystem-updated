/**
 * GDPR-oriented redaction helpers for audit payloads.
 * Strips emails, phones, passwords, tokens, and other sensitive keys before persistence.
 */

const SENSITIVE_KEY_PATTERN =
  /^(password|passwd|pwd|secret|token|accessToken|refreshToken|access_token|refresh_token|authorization|apiKey|api_key|privateKey|private_key|otp|totp|backupCode|backup_code)$/i;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_PATTERN = /(\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;

const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED EMAIL]';
const REDACTED_PHONE = '[REDACTED PHONE]';

/**
 * Redacts email and phone substrings from free-form text.
 *
 * @param text - Raw string that may contain PII
 * @returns Sanitized string safe for audit storage
 */
export function redactText(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(EMAIL_PATTERN, REDACTED_EMAIL).replace(PHONE_PATTERN, REDACTED_PHONE);
}

/**
 * Deep-clones and redacts sensitive keys / PII from an arbitrary JSON-like value.
 *
 * @param value - Payload fragment to sanitize
 * @returns GDPR-safe clone suitable for EventLog.payload
 */
export function redactPayload(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactPayload(nested);
      }
    }
    return result;
  }

  return value;
}

/**
 * Returns a typed record after GDPR redaction.
 *
 * @param payload - Original audit payload
 * @returns Redacted record
 */
export function redactAuditPayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) {
    return {};
  }
  return redactPayload(payload) as Record<string, unknown>;
}
