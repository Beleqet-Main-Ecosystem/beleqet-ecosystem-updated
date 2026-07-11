import { CURRENCIES, type CurrencyCode } from "@/hooks/useCurrency";

/**
 * Convert a raw ETB amount to any supported currency.
 *
 * Pure function — safe to use in Server Components and unit tests.
 * For client-side state with `localStorage` persistence use `useCurrency` instead.
 *
 * @param amountETB - The value in Ethiopian Birr.
 * @param to - Target ISO 4217 currency code.
 * @returns Converted amount as a plain number.
 *
 * @example
 * convertFromETB(1500, "USD"); // ~10.35
 */
export function convertFromETB(amountETB: number, to: CurrencyCode): number {
  return amountETB * CURRENCIES[to].rateFromETB;
}

/**
 * Format a raw ETB amount as a localised currency string.
 *
 * Pure function — safe to use in Server Components and unit tests.
 *
 * @param amountETB - The value in Ethiopian Birr.
 * @param currency - Target currency code. Defaults to `"ETB"`.
 * @returns Formatted string, e.g. `"ETB 1,500"` or `"$10.35"`.
 *
 * @example
 * formatCurrency(1500, "USD"); // "$10.35"
 * formatCurrency(1500);        // "ETB 1,500"
 */
export function formatCurrency(amountETB: number, currency: CurrencyCode = "ETB"): string {
  const converted = convertFromETB(amountETB, currency);
  if (currency === "ETB") {
    return `ETB ${converted.toLocaleString("en-ET", { maximumFractionDigits: 0 })}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(converted);
}
