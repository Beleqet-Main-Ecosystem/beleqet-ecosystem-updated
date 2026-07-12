/**
 * Currency Converter Utility
 * Provides simple conversions between ETB, USD, and EUR.
 */

const CONVERSION_RATES_TO_ETB: Record<string, number> = {
  ETB: 1.0,
  USD: 120.0,
  EUR: 130.0,
};

/**
 * Convert an amount from one currency to another.
 */
export function convertCurrency(amount: number, from: string, to: string): number {
  const normalizedFrom = from.toUpperCase();
  const normalizedTo = to.toUpperCase();

  const rateFrom = CONVERSION_RATES_TO_ETB[normalizedFrom] || 1.0;
  const rateTo = CONVERSION_RATES_TO_ETB[normalizedTo] || 1.0;

  // Convert to ETB first, then convert to the target currency
  const amountInEtb = amount * rateFrom;
  return amountInEtb / rateTo;
}
