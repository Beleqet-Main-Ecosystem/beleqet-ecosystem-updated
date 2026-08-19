/** Injection token for the platform currency conversion capability used by Admin Stats. */
export const ADMIN_STATS_CURRENCY_CONVERTER = Symbol('ADMIN_STATS_CURRENCY_CONVERTER');

/** Minimal dependency boundary required to normalize revenue into a display currency. */
export interface CurrencyConverter {
  convertCurrency(amount: number, from: string, to: string): number;
}
