"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { CURRENCIES, type CurrencyCode, type UseCurrencyReturn } from "@/hooks/useCurrency";

const STORAGE_KEY = "beleqet-currency";
const DEFAULT_CURRENCY: CurrencyCode = "ETB";

const CurrencyContext = createContext<UseCurrencyReturn | null>(null);

/**
 * Provides a shared currency state to the entire application.
 *
 * Wrap this around the app root (in `layout.tsx`) once.
 * All child components can then call `useCurrencyContext()` to read
 * or change the active currency and receive instant re-renders.
 *
 * The selected currency is persisted to `localStorage` under the key
 * `beleqet-currency` so the preference survives page refreshes.
 *
 * @param children - React subtree that needs access to currency state.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  // Hydrate from localStorage on first client render
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
      if (stored && stored in CURRENCIES) setCurrencyState(stored);
    } catch { /* private browsing — fail silently */ }
  }, []);

  /** Update the active currency and persist the selection. */
  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!(code in CURRENCIES)) return;
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* silent */ }
  }, []);

  /**
   * Convert a raw ETB amount to the currently selected currency.
   * @param amountETB - The value in Ethiopian Birr.
   * @returns Converted amount as a plain number.
   */
  const convert = useCallback(
    (amountETB: number) => amountETB * CURRENCIES[currency].rateFromETB,
    [currency],
  );

  /**
   * Format a raw ETB amount as a localised currency string.
   * @param amountETB - The value in Ethiopian Birr.
   * @returns Formatted string, e.g. `"ETB 1,500"` or `"$10.35"`.
   */
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

  const value: UseCurrencyReturn = {
    currency,
    currencyMeta: CURRENCIES[currency],
    currencies: Object.values(CURRENCIES),
    setCurrency,
    format,
    convert,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/**
 * Returns the shared currency state from the nearest `CurrencyProvider`.
 *
 * @throws Error when used outside of `<CurrencyProvider>`.
 * @returns The full `UseCurrencyReturn` object (currency, setCurrency, format, convert).
 */
export function useCurrencyContext(): UseCurrencyReturn {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrencyContext must be used inside <CurrencyProvider>");
  return ctx;
}
