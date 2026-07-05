import { createHash } from 'crypto';

/**
 * @file paypal-pii.utils.ts
 * @module PayPal
 * @description GDPR-compliant PII (Personally Identifiable Information) masking utilities.
 *
 * PayPal API responses may contain personal identifiers including buyer email addresses,
 * full names, phone numbers, and shipping addresses. Storing these in the `gatewayResponse`
 * JSONB column verbatim would violate GDPR Article 5(1)(e) (storage limitation) and
 * Article 25 (data protection by design).
 *
 * **Strategy chosen**: Pseudonymisation (GDPR Recital 26).
 * - Email addresses are SHA-256 hashed (one-way, but still linkable if the original
 *   email is known — compliant with pseudonymisation definition).
 * - Name, phone, and address fields are replaced with a fixed sentinel string.
 * - All other fields pass through unchanged.
 *
 * @see {@link https://gdpr-info.eu/art-25-gdpr/} GDPR Article 25
 * @see {@link https://gdpr-info.eu/recitals/no-26/} Recital 26 — Pseudonymisation
 */

/** Sentinel string inserted in place of stripped (non-hashable) PII fields. */
export const GDPR_REDACTED = '[GDPR_REDACTED]';

/**
 * PII field names that are **hashable** — replaced with their SHA-256 digest.
 * Email addresses are hashed so they remain linkable but non-reversible.
 */
const HASHABLE_PII_FIELDS = new Set(['email_address', 'email']);

/**
 * PII field names that are **removed entirely** — too personal to pseudonymise.
 * Names, phones, and addresses cannot be reliably de-identified by hashing.
 */
const REDACTABLE_PII_FIELDS = new Set([
  'given_name',
  'surname',
  'full_name',
  'phone',
  'phone_number',
  'address',
  'address_line_1',
  'address_line_2',
  'admin_area_1',
  'admin_area_2',
  'postal_code',
  'country_code',
  'national_number',
]);

/**
 * Computes a one-way SHA-256 hash of a string value.
 * The output is a 64-character lowercase hexadecimal digest.
 *
 * @param value - The plaintext string to hash
 * @returns 64-char hex SHA-256 digest
 *
 * @example
 * ```ts
 * hashPii('buyer@example.com');
 * // → 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'
 * ```
 */
export function hashPii(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Recursively traverses a JSON-compatible object and masks PII fields in-place
 * according to the GDPR pseudonymisation strategy defined in this module.
 *
 * - **Email fields**: replaced with `sha256(original_value)` (pseudonymised)
 * - **Name/phone/address fields**: replaced with `"[GDPR_REDACTED]"` (removed)
 * - **Arrays**: each element is processed recursively
 * - **Primitives**: returned unchanged
 *
 * This function does **not** mutate the original object — it returns a deep clone
 * with PII fields replaced.
 *
 * @param payload - Any value from a PayPal API response (object, array, or primitive)
 * @returns A new value with PII fields masked
 *
 * @example
 * ```ts
 * const raw = {
 *   id: 'ORDER-123',
 *   payer: {
 *     email_address: 'buyer@example.com',
 *     name: { given_name: 'John', surname: 'Doe' },
 *   },
 * };
 *
 * const safe = maskPayerPii(raw);
 * // safe.payer.email_address → 'a665a459...' (SHA-256 hash)
 * // safe.payer.name.given_name → '[GDPR_REDACTED]'
 * // safe.id → 'ORDER-123' (unchanged)
 * ```
 */
export function maskPayerPii(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => maskPayerPii(item));
  }

  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (HASHABLE_PII_FIELDS.has(key) && typeof value === 'string') {
        // Pseudonymise: replace with SHA-256 hash
        result[key] = hashPii(value);
      } else if (REDACTABLE_PII_FIELDS.has(key)) {
        // Redact: replace with sentinel string
        result[key] = GDPR_REDACTED;
      } else {
        // Recurse into nested objects/arrays
        result[key] = maskPayerPii(value);
      }
    }
    return result;
  }

  // Primitive — return as-is
  return payload;
}

/**
 * Convenience wrapper that handles `null`/`undefined` gracefully and
 * always returns a JSON-serializable plain object.
 *
 * Use this directly before assigning to a Prisma `Json` field.
 *
 * @param response - The raw PayPal API response (may be undefined in mock mode)
 * @returns A GDPR-safe plain object, or `{}` if input is nullish
 *
 * @example
 * ```ts
 * // In a service:
 * await this.prisma.paypalTransaction.update({
 *   where: { id: tx.id },
 *   data: {
 *     gatewayResponse: sanitiseForStorage(rawResponse),
 *   },
 * });
 * ```
 */
export function sanitiseForStorage(response: unknown): object {
  if (response === null || response === undefined) return {};
  return maskPayerPii(response) as object;
}
