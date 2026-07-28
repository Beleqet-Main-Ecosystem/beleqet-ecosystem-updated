export declare enum TaxCurrency {
    USD = "USD",
    ETB = "ETB"
}
export declare class CalculateTaxDto {
    grossIncome: number;
    currency: TaxCurrency;
    countryCode: string;
}
export interface TaxCalculationResult {
    grossIncome: number;
    taxAmount: number;
    netIncome: number;
    currency: TaxCurrency;
    countryCode: string;
    effectiveTaxRate: number;
}
