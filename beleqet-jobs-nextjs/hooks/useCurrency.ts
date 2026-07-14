"use client";

import { useState, useEffect, useCallback } from "react";

/** ISO 4217 currency codes supported by this application. */
export type CurrencyCode = "ETB" | "USD" | "EUR" | "GBP";

/** Metadata for a single supported currency. */
export interface CurrencyMeta {
  /** ISO 4217 currency code. */
  code: CurrencyCode;
  /** Human-readable label, e.g. `"Ethiopian Birr"`. */
  label: string;
  /** Unicode symbol, e.g. `"$"`. */
  symbol: string;
  /** Flag emoji for the currency's primary country. */
  flag: string;
  /** Approximate exchange rate: `1 ETB = rateFromETB <currency>`. */
  rateFromETB: number;
}

/**
 * Static exchange-rate catalogue.
 *
 * All rates represent how many units of each currency equal 1 ETB.
 * Replace with a live rate feed in production.
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  ETB: { code: "ETB", label: "Ethiopian Birr", symbol: "ETB", flag: "🇪🇹", rateFromETB: 1 },
  USD: { code: "USD", label: "US Dollar",       symbol: "$",   flag: "🇺🇸", rateFromETB: 0.0069 },
  EUR: { code: "EUR", label: "Euro",            symbol: "€",   flag: "🇪🇺", rateFromETB: 0.0062 },
  GBP: { code: "GBP", label: "British Pound",   symbol: "£",   flag: "🇬🇧", rateFromETB: 0.0053 },
};

const STORAGE_KEY = "beleqet-currency";
const DEFAULT_CURRENCY: CurrencyCode = "ETB";

/** Return type of the `useCurrency` hook. */
export interface UseCurrencyReturn {
  /** The currently active currency code. */
  currency: CurrencyCode;
  /** Full metadata for the active currency. */
  currencyMeta: CurrencyMeta;
  /** All supported currencies as an array. */
  currencies: CurrencyMeta[];
  /**
   * Change the active currency and persist the choice to `localStorage`.
   * @param code - The currency code to switch to.
   */
  setCurrency: (code: CurrencyCode) => void;
  /**
   * Format a raw ETB amount as a localised currency string.
   * @param amountETB - Value in Ethiopian Birr.
   * @returns Formatted string, e.g. `"ETB 1,500"` or `"$10.35"`.
   */
  format: (amountETB: number) => string;
  /**
   * Convert a raw ETB amount to the active currency.
   * @param amountETB - Value in Ethiopian Birr.
   * @returns Converted amount as a plain number.
   */
  convert: (amountETB: number) => number;
}

/**
 * Hook for multi-currency support.
 *
 * Manages the selected currency in local component state and persists it to
 * `localStorage` (key: `beleqet-currency`) so the preference survives page
 * refreshes. No PII is stored — GDPR-safe.
 *
 * **Prefer `useCurrencyContext`** when the currency must be shared across
 * multiple components. Use this hook for isolated, self-contained use cases.
 *
 * @returns Currency state, setter, `format`, and `convert` helpers.
 *
 * @example
 * const { currency, setCurrency, format } = useCurrency();
 * format(1500); // "ETB 1,500" | "$10.35" depending on selection
 */
export function useCurrency(): UseCurrencyReturn {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  // Restore saved currency on first client render
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && stored in CURRENCIES) setCurrencyState(stored);
    } catch { /* private browsing — fail silently */ }
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!(code in CURRENCIES)) return;
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* silent */ }
  }, []);

  const convert = useCallback(
    (amountETB: number): number => amountETB * CURRENCIES[currency].rateFromETB,
    [currency],
  );

  const format = useCallback(
    (amountETB: number): string => {
      const converted = amountETB * CURRENCIES[currency].rateFromETB;
      if (currency === "ETB") {
        return `ETB ${converted.toLocaleString("en-ET", { maximumFractionDigits: 0 })}`;
      }
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(converted);
    },
    [currency],
  );

  return {
    currency,
    currencyMeta: CURRENCIES[currency],
    currencies: Object.values(CURRENCIES),
    setCurrency,
    format,
    convert,
  };
}
