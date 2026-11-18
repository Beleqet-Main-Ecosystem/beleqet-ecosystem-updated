/**
 * Localized representation of a monetary value.
 */
export interface MoneyAmount {
  /** The integer amount in the smallest currency unit (e.g. cents/Santim). */
  amount: number;
  /** The uppercase currency code, e.g. 'ETB' or 'USD'. */
  currency: 'ETB' | 'USD';
}

/**
 * Utility functions for currency math and presentation formatting in the frontend application.
 * Prevents floating-point errors by storing monetary values as integers.
 */
export class CurrencyUtil {
  /**
   * Converts decimal representation to integer-based smallest unit (e.g. 50.50 -> 5050).
   *
   * @param amount - Decimal number to convert.
   * @returns Integer value in smallest currency unit.
   * @throws Error if input is not a number.
   * @security GDPR/Consent: None. No GDPR or sensitive information is handled here.
   */
  static toSmallestUnit(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Monetary amount must be a number.');
    }
    return Math.round(amount * 100);
  }

  /**
   * Converts small-unit integer back to decimal format (e.g. 5050 -> 50.50).
   *
   * @param smallestUnit - Integer value representing cents/Santim.
   * @returns Decimal representation of the amount.
   * @throws Error if input is not an integer.
   * @security GDPR/Consent: None.
   */
  static toDecimal(smallestUnit: number): number {
    if (typeof smallestUnit !== 'number' || !Number.isInteger(smallestUnit)) {
      throw new Error('Smallest unit must be an integer.');
    }
    return smallestUnit / 100;
  }

  /**
   * Formats an integer amount in cents/Santim to a localized display string.
   *
   * @param smallestUnit - Integer amount to format.
   * @param currency - Currency code string ('ETB' or 'USD'). Defaults to 'ETB'.
   * @param locale - Locale identifier string. Defaults to 'en-US'.
   * @returns Localized and formatted currency string (e.g., "$1.00" or "ETB 50.00").
   * @throws Error if input smallestUnit is not an integer.
   * @security GDPR/PII Alert: Be careful when appending names/details of users directly next to currency balances in logs.
   */
  static format(smallestUnit: number, currency: 'ETB' | 'USD' = 'ETB', locale = 'en-US'): string {
    const decimal = this.toDecimal(smallestUnit);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(decimal);
  }
}
