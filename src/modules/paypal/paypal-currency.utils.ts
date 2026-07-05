/**
 * @file paypal-currency.utils.ts
 * @module PayPal
 * @description Multi-currency formatting and validation utilities for PayPal payments.
 *
 * Provides a canonical list of supported currencies, amount formatting via the
 * ECMA-402 `Intl.NumberFormat` API, and minor-unit conversion for currencies
 * that have zero decimal places (e.g. JPY).
 *
 * **Mock-mode currencies**: ETB (Ethiopian Birr) is included in the supported list
 * for the local simulator only. It must be blocked for live/sandbox PayPal API calls
 * because PayPal does not natively support ETB. Services must check `isMockOnlyCurrency`
 * before forwarding any currency to the PayPal REST API.
 *
 * @see {@link https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/}
 *      PayPal Supported Currencies
 * @see {@link https://www.iso.org/iso-4217-currency-codes.html} ISO 4217
 */

/**
 * Metadata for a supported currency.
 */
export interface CurrencyMeta {
  /** ISO-4217 3-letter code */
  code: string;
  /** Human-readable display name */
  name: string;
  /** Unicode currency symbol */
  symbol: string;
  /** Number of decimal places for minor-unit conversion (0 for JPY etc.) */
  decimals: number;
  /**
   * If `true`, this currency is only valid in `PAYPAL_MODE=mock` (simulator).
   * It must NOT be forwarded to the PayPal REST API in sandbox or live mode.
   */
  mockOnly?: boolean;
}

/**
 * Canonical list of currencies supported by this platform.
 *
 * To add a new currency, append an entry here and update the DTO `@IsIn` whitelist.
 * Currencies marked `mockOnly: true` are accepted by the local simulator but will
 * throw a `BadRequestException` if used with the live PayPal API.
 */
export const SUPPORTED_CURRENCIES: CurrencyMeta[] = [
  { code: 'USD', name: 'US Dollar',          symbol: '$',  decimals: 2 },
  { code: 'EUR', name: 'Euro',               symbol: '€',  decimals: 2 },
  { code: 'GBP', name: 'British Pound',      symbol: '£',  decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar',  symbol: 'A$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar',    symbol: 'C$', decimals: 2 },
  { code: 'ETB', name: 'Ethiopian Birr',     symbol: 'Br', decimals: 2, mockOnly: true },
];

/** Set of all currency codes (real + mock-only) for fast O(1) lookups */
export const CURRENCY_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

/** Set of currency codes valid for live/sandbox PayPal API calls (excludes mockOnly) */
export const LIVE_CURRENCY_CODES = new Set(
  SUPPORTED_CURRENCIES.filter((c) => !c.mockOnly).map((c) => c.code),
);

/**
 * Returns the `CurrencyMeta` for the given ISO-4217 code, or `undefined` if unsupported.
 *
 * @param code - ISO-4217 3-letter currency code (e.g. `'USD'`)
 * @returns Matching {@link CurrencyMeta} or `undefined`
 *
 * @example
 * ```ts
 * getCurrencyMeta('EUR');
 * // → { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 }
 *
 * getCurrencyMeta('XYZ');
 * // → undefined
 * ```
 */
export function getCurrencyMeta(code: string): CurrencyMeta | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}

/**
 * Returns `true` if the currency is mock/simulator-only and must not be sent to
 * the live PayPal API.
 *
 * @param code - ISO-4217 currency code to check
 *
 * @example
 * ```ts
 * isMockOnlyCurrency('ETB'); // → true  (ETB not supported by PayPal)
 * isMockOnlyCurrency('USD'); // → false (USD supported everywhere)
 * ```
 */
export function isMockOnlyCurrency(code: string): boolean {
  return getCurrencyMeta(code)?.mockOnly === true;
}

/**
 * Formats a numeric amount as a localised currency string using the ECMA-402
 * `Intl.NumberFormat` API. Falls back to the `en-US` locale if `locale` is unsupported.
 *
 * @param amount  - The numeric amount to format (e.g. `1500.5`)
 * @param code    - ISO-4217 currency code (e.g. `'USD'`)
 * @param locale  - BCP-47 locale tag (default: `'en-US'`)
 * @returns Localised currency string (e.g. `'$1,500.50'` or `'€1.500,50'`)
 *
 * @example
 * ```ts
 * formatAmount(1500.5, 'USD');         // → '$1,500.50'
 * formatAmount(1500.5, 'EUR', 'de-DE'); // → '1.500,50 €'
 * formatAmount(200, 'ETB', 'am');       // → 'Br200.00'
 * ```
 */
export function formatAmount(amount: number, code: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style:    'currency',
      currency: code,
    }).format(amount);
  } catch {
    // Fallback for unsupported locale strings
    const meta = getCurrencyMeta(code);
    return `${meta?.symbol ?? code} ${amount.toFixed(meta?.decimals ?? 2)}`;
  }
}

/**
 * Converts a decimal amount to its minor unit representation (integer).
 * This is required by some payment APIs that expect amounts in cents/pence.
 *
 * @param amount   - Decimal amount (e.g. `19.99`)
 * @param currency - ISO-4217 currency code to determine decimal places
 * @returns Integer minor unit value (e.g. `1999` for `$19.99`)
 *
 * @example
 * ```ts
 * toMinorUnits(19.99, 'USD'); // → 1999
 * toMinorUnits(500,   'JPY'); // → 500  (JPY has 0 decimal places)
 * toMinorUnits(19.99, 'ETB'); // → 1999
 * ```
 */
export function toMinorUnits(amount: number, currency: string): number {
  const meta = getCurrencyMeta(currency);
  const factor = Math.pow(10, meta?.decimals ?? 2);
  return Math.round(amount * factor);
}

/**
 * Validates that a given ISO-4217 code is in the platform's supported currency list.
 * Returns `false` for unsupported codes (including null/undefined).
 *
 * @param code - Currency code to validate
 * @returns `true` if the code is supported (including mock-only currencies)
 *
 * @example
 * ```ts
 * isValidCurrencyCode('USD'); // → true
 * isValidCurrencyCode('ETB'); // → true  (mock-only, but in the list)
 * isValidCurrencyCode('XYZ'); // → false
 * ```
 */
export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_CODES.has(code);
}
