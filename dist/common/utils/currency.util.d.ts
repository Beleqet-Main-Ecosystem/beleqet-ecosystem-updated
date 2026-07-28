export declare class CurrencyUtil {
    static toSmallestUnit(amount: number): number;
    static toDecimal(smallestUnit: number): number;
    static add(a: number, b: number): number;
    static subtract(a: number, b: number): number;
    static multiply(amount: number, factor: number): number;
    static format(smallestUnit: number, currency?: string, locale?: string): string;
}
