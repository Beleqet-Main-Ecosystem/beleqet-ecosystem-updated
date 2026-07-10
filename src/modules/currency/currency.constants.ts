// =============================================================================
// Beleqet — Supported Currencies & Fallback Exchange Rates
// =============================================================================

export const SUPPORTED_CURRENCIES = ['ETB', 'USD', 'EUR', 'GBP'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Static fallback rates (relative to USD = 1), used only when the live
 * Exchange Rate API is unreachable and no cached rates are available.
 */
export const FALLBACK_USD_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  ETB: 120.5,
  EUR: 0.93,
  GBP: 0.79,
};
