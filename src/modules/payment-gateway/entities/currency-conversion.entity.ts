/**
 * Entity representing a currency conversion result.
 */
export class CurrencyConversionEntity {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateSource: string;
  timestamp: Date;
  formattedOriginal: string;
  formattedConverted: string;
}
