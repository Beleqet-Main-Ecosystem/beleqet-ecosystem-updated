import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ExchangeRateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private cache: ExchangeRateCache | null = null;
  private readonly cacheTtlMs: number;
  private readonly fallbackRates: Record<string, number>;

  constructor(private readonly config: ConfigService) {
    this.cacheTtlMs = (this.config.get<number>('CURRENCY_CACHE_TTL_MINUTES') ?? 60) * 60 * 1000;

    this.fallbackRates = {
      'USD_ETB': this.config.get<number>('RATE_USD_ETB') ?? 120.5,
      'EUR_ETB': this.config.get<number>('RATE_EUR_ETB') ?? 130.2,
      'GBP_ETB': this.config.get<number>('RATE_GBP_ETB') ?? 152.0,
      'KES_ETB': this.config.get<number>('RATE_KES_ETB') ?? 0.93,
      'NGN_ETB': this.config.get<number>('RATE_NGN_ETB') ?? 0.08,
      'ZAR_ETB': this.config.get<number>('RATE_ZAR_ETB') ?? 6.7,
      'AED_ETB': this.config.get<number>('RATE_AED_ETB') ?? 32.8,
      'INR_ETB': this.config.get<number>('RATE_INR_ETB') ?? 1.45,
      'CAD_ETB': this.config.get<number>('RATE_CAD_ETB') ?? 88.5,
      'AUD_ETB': this.config.get<number>('RATE_AUD_ETB') ?? 79.2,
      'JPY_ETB': this.config.get<number>('RATE_JPY_ETB') ?? 0.81,
      'CHF_ETB': this.config.get<number>('RATE_CHF_ETB') ?? 136.8,
    };

    // Pre-compute inverse rates
    for (const [pair, rate] of Object.entries(this.fallbackRates)) {
      const [from, to] = pair.split('_');
      const inverse = `${to}_${from}`;
      if (!this.fallbackRates[inverse]) {
        this.fallbackRates[inverse] = Math.round((1 / rate) * 1_000_000) / 1_000_000;
      }
    }
  }

  async getRates(): Promise<Record<string, number>> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.cache.rates;
    }

    const apiUrl = this.config.get<string>('EXCHANGE_RATE_API_URL');
    const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY');

    if (apiUrl && apiKey) {
      try {
        const response = await fetch(`${apiUrl}?base=ETB&apikey=${apiKey}`);
        if (response.ok) {
          const data = await response.json() as { rates?: Record<string, number> };
          if (data.rates) {
            const rates: Record<string, number> = {};
            for (const [currency, etbRate] of Object.entries(data.rates)) {
              if (typeof etbRate === 'number' && etbRate > 0) {
                rates[`${currency}_ETB`] = Math.round((1 / etbRate) * 1_000_000) / 1_000_000;
                rates[`ETB_${currency}`] = etbRate;
              }
            }
            this.cache = { rates, fetchedAt: Date.now() };
            this.logger.log('Exchange rates refreshed from API');
            return rates;
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch exchange rates: ${(err as Error).message}. Using fallback.`);
      }
    }

    this.cache = { rates: { ...this.fallbackRates }, fetchedAt: Date.now() };
    return this.cache.rates;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rates = await this.getRates();
    const pair = `${from}_${to}`;
    const rate = rates[pair];
    if (!rate) {
      throw new BadRequestException(`Exchange rate for ${from} to ${to} is not available`);
    }
    return Math.round(amount * rate);
  }

  getSupportedPairs(): string[] {
    return [...new Set(
      Object.keys(this.fallbackRates).map(p => p.split('_')[0]),
    )].sort();
  }

  getRatesSync(): Record<string, number> {
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTtlMs) {
      return this.cache.rates;
    }
    this.cache = { rates: { ...this.fallbackRates }, fetchedAt: Date.now() };
    return this.cache.rates;
  }
}
