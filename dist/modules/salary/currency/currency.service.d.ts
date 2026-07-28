import { ConfigService } from '@nestjs/config';
export type CurrencyCode = 'ETB' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SAR';
interface ExchangeRates {
    base: number;
    ETB: number;
    USD: number;
    EUR: number;
    GBP: number;
    AED: number;
    SAR: number;
}
export declare class CurrencyService {
    private readonly configService;
    private readonly logger;
    private exchangeRates;
    constructor(configService: ConfigService);
    private loadExchangeRates;
    convert(amount: number, from: CurrencyCode, to: CurrencyCode): number;
    convertSalaryPrediction(prediction: {
        minSalary: number;
        maxSalary: number;
        averageSalary: number;
        medianSalary: number;
        currency: string;
        standardDeviation: number;
    }, targetCurrency: CurrencyCode, sourceCurrency?: CurrencyCode): typeof prediction;
    getSupportedCurrencies(): CurrencyCode[];
    isSupported(currency: string): boolean;
    updateExchangeRates(newRates: Partial<ExchangeRates>): void;
    getExchangeRate(currency: CurrencyCode): number;
}
export {};
