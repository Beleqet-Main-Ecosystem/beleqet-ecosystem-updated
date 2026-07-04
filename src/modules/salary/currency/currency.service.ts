import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private exchangeRates: ExchangeRates;

  constructor(private readonly configService: ConfigService) {
    this.exchangeRates = this.loadExchangeRates();
  }

  /**
   * Load exchange rates relative to ETB (Ethiopian Birr)
   * In production, this would fetch from an external API or database
   * Rates are as of 2024 - should be updated regularly
   */
  private loadExchangeRates(): ExchangeRates {
    const rates = this.configService.get<ExchangeRates>('EXCHANGE_RATES');
    if (rates) {
      return rates;
    }
    return {
      base: 1,
      ETB: 1,
      USD: 140,
      EUR: 152,
      GBP: 180,
      AED: 38,
      SAR: 38,
    };
  }

  /**
   * Convert salary amount from one currency to another
   *
   * @param amount - The amount to convert
   * @param from - Source currency code
   * @param to - Target currency code
   * @returns Converted amount rounded to nearest integer
   * @example convert(100000, 'ETB', 'USD') returns ~714
   */
  convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) {
      return Math.round(amount);
    }

    // Rates are in ETB per 1 foreign currency
    // To convert: amount * (fromRate / toRate)
    // This gives: ETB amount * (ETB per USD) / (ETB per USD) = USD amount
    const rateFrom = this.exchangeRates[from] || 1;
    const rateTo = this.exchangeRates[to] || 1;

    const converted = (amount * rateFrom) / rateTo;
    this.logger.debug(`Converted ${amount} ${from} to ${converted.toFixed(2)} ${to}`);

    return Math.round(converted);
  }

  /**
   * Convert salary prediction to target currency
   *
   * @param prediction - Salary prediction object with min/max/average/median
   * @param targetCurrency - Currency to convert to
   * @param sourceCurrency - Original currency (defaults to ETB)
   * @returns Salary prediction with converted values
   */
  convertSalaryPrediction(
    prediction: {
      minSalary: number;
      maxSalary: number;
      averageSalary: number;
      medianSalary: number;
      currency: string;
      standardDeviation: number;
    },
    targetCurrency: CurrencyCode,
    sourceCurrency: CurrencyCode = 'ETB',
  ): typeof prediction {
    if (targetCurrency === sourceCurrency) {
      return prediction;
    }

    return {
      minSalary: this.convert(prediction.minSalary, sourceCurrency, targetCurrency),
      maxSalary: this.convert(prediction.maxSalary, sourceCurrency, targetCurrency),
      averageSalary: this.convert(prediction.averageSalary, sourceCurrency, targetCurrency),
      medianSalary: this.convert(prediction.medianSalary, sourceCurrency, targetCurrency),
      currency: targetCurrency,
      standardDeviation: this.convert(prediction.standardDeviation, sourceCurrency, targetCurrency),
    };
  }

  /**
   * Get all supported currency codes
   *
   * @returns Array of supported currency codes
   */
  getSupportedCurrencies(): CurrencyCode[] {
    return ['ETB', 'USD', 'EUR', 'GBP', 'AED', 'SAR'];
  }

  /**
   * Check if a currency is supported
   *
   * @param currency - Currency code to validate
   * @returns True if currency is supported
   */
  isSupported(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency as CurrencyCode);
  }

  /**
   * Refresh exchange rates from external source
   *
   * @param newRates - New exchange rates object
   */
  updateExchangeRates(newRates: Partial<ExchangeRates>): void {
    this.exchangeRates = { ...this.exchangeRates, ...newRates };
    this.logger.log('Exchange rates updated');
  }

  /**
   * Get current exchange rate for a currency
   *
   * @param currency - Currency code
   * @returns Exchange rate relative to ETB, or 1 if not found
   */
  getExchangeRate(currency: CurrencyCode): number {
    return this.exchangeRates[currency] || 1;
  }
}