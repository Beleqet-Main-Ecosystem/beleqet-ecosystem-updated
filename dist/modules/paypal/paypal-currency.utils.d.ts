export interface CurrencyMeta {
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    mockOnly?: boolean;
}
export declare const SUPPORTED_CURRENCIES: CurrencyMeta[];
export declare const CURRENCY_CODES: Set<string>;
export declare const LIVE_CURRENCY_CODES: Set<string>;
export declare function getCurrencyMeta(code: string): CurrencyMeta | undefined;
export declare function isMockOnlyCurrency(code: string): boolean;
export declare function formatAmount(amount: number, code: string, locale?: string): string;
export declare function toMinorUnits(amount: number, currency: string): number;
export declare function isValidCurrencyCode(code: string): boolean;
