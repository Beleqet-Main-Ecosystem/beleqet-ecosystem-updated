/**
 * Utility functions for GDPR PII (Personally Identifiable Information) masking and scrubbing.
 * Formats or redacts sensitive request/response data prior to persistent logging.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'ssn',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
]);

/**
 * Masks email address for GDPR compliance while keeping format recognizable.
 * Example: "user@example.com" -> "u***r@example.com"
 *
 * @param email - Raw email string
 * @returns Masked email string
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '[REDACTED_EMAIL]';
  }
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks phone number for GDPR compliance.
 * Example: "+1234567890" -> "+12***7890"
 *
 * @param phone - Raw phone number string
 * @returns Masked phone number string
 */
export function maskPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '[REDACTED_PHONE]';
  }
  if (phone.length <= 6) {
    return '***';
  }
  const start = phone.slice(0, 3);
  const end = phone.slice(-4);
  return `${start}***${end}`;
}

/**
 * Recursively inspects objects/arrays and scrubs or masks sensitive PII fields.
 *
 * @param data - Target payload (object, array, or primitive)
 * @returns Deep clone with sensitive data masked or scrubbed
 * @security GDPR/Consent: Enforces strict data minimization by scrubbing PII.
 */
export function scrubPii<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date || data instanceof Buffer || data instanceof RegExp) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubPii(item)) as unknown as T;
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.has(lowerKey)) {
      scrubbed[key] = '[REDACTED]';
    } else if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token')
    ) {
      scrubbed[key] = '[REDACTED]';
    } else if (lowerKey === 'email' && typeof value === 'string') {
      scrubbed[key] = maskEmail(value);
    } else if (lowerKey === 'phone' && typeof value === 'string') {
      scrubbed[key] = maskPhone(value);
    } else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = scrubPii(value);
    } else {
      scrubbed[key] = value;
    }
  }

  return scrubbed as T;
}
