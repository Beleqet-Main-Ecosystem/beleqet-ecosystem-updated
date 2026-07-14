/**
 * Utility containing methods for safe integer-based currency calculations and formatting.
 * Strictly avoids floating-point precision issues by representing all monetary values
 * as integers in the smallest currency unit (e.g., cents or Santims).
 */
export class CurrencyUtil {
  /**
   * Converts a decimal monetary amount to an integer representing the smallest unit (e.g., cents/Santim).
   * Rounded to the nearest integer.
   *
   * @param amount - The decimal monetary amount to convert.
   * @returns The integer value in the smallest unit.
   * @throws Error if the provided amount is not a valid number.
   * @security GDPR/Consent: None. No GDPR or sensitive information is handled by this mathematical function.
   */
  static toSmallestUnit(amount: number): number {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Invalid monetary amount: Must be a valid number.');
    }
    return Math.round(amount * 100);
  }

  /**
   * Converts an integer in the smallest unit (e.g., cents/Santim) back to a decimal representation.
   *
   * @param smallestUnit - The integer in the smallest currency unit.
   * @returns The decimal monetary amount.
   * @throws Error if the smallest unit is not an integer.
   * @security GDPR/Consent: None. Mathematical operation with no GDPR implications.
   */
  static toDecimal(smallestUnit: number): number {
    if (typeof smallestUnit !== 'number' || !Number.isInteger(smallestUnit)) {
      throw new Error('Invalid input: Smallest unit value must be an integer.');
    }
    return smallestUnit / 100;
  }

  /**
   * Safely adds two integer amounts in their smallest units.
   *
   * @param a - First integer amount in smallest unit.
   * @param b - Second integer amount in smallest unit.
   * @returns The sum as an integer.
   * @throws Error if inputs are not valid integers.
   * @security GDPR/Consent: None. No data processing consent or PII is affected.
   */
  static add(a: number, b: number): number {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Addition inputs must be safe integers representing the smallest currency units.');
    }
    return a + b;
  }

  /**
   * Safely subtracts the second integer amount from the first.
   *
   * @param a - Minuend integer amount in smallest unit.
   * @param b - Subtrahend integer amount in smallest unit.
   * @returns The difference as an integer.
   * @throws Error if inputs are not valid integers.
   * @security GDPR/Consent: None. No data processing consent or PII is affected.
   */
  static subtract(a: number, b: number): number {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      throw new Error('Subtraction inputs must be safe integers representing the smallest currency units.');
    }
    return a - b;
  }

  /**
   * Safely multiplies an integer amount by a numeric factor (e.g. tax, interest, fee fraction)
   * and rounds to the nearest integer.
   *
   * @param amount - The integer amount in smallest unit.
   * @param factor - The numeric multiplier.
   * @returns The rounded product as an integer.
   * @throws Error if the amount is not an integer or factor is not a number.
   * @security GDPR/Consent: None. No data processing consent or PII is affected.
   */
  static multiply(amount: number, factor: number): number {
    if (!Number.isInteger(amount) || typeof factor !== 'number' || isNaN(factor)) {
      throw new Error('Multiplication inputs must be an integer amount and a valid factor.');
    }
    return Math.round(amount * factor);
  }

  /**
   * Formats a small-unit integer amount into a readable localized decimal string.
   *
   * @param smallestUnit - The integer in the smallest unit.
   * @param currency - The currency code (e.g. 'ETB', 'USD'). Defaults to 'ETB'.
   * @param locale - The locale tag (e.g. 'en-US', 'am-ET'). Defaults to 'en-US'.
   * @returns The formatted locale-specific string.
   * @throws Error if smallest unit is not an integer.
   * @security GDPR/PII Alert: The return value formats currency amounts which might be combined with user names.
   *           Always mask user identities before displaying localized transaction values in public logs.
   */
  static format(smallestUnit: number, currency = 'ETB', locale = 'en-US'): string {
    const decimalValue = this.toDecimal(smallestUnit);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(decimalValue);
  }
}
