import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyCode, FALLBACK_USD_RATES, SUPPORTED_CURRENCIES } from './currency.constants';

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

interface LiveRatesResponse {
  result?: string;
  rates?: Record<string, number>;
}

/**
 * Supplies live currency exchange rates for the Multi-Currency Wallet.
 * Rates are fetched from an external Exchange Rate API and cached in-memory
 * per base currency for EXCHANGE_RATE_CACHE_TTL_MS. If the live fetch fails,
 * falls back to the last known-good cached rates, then to a static table.
 */
@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly cache = new Map<string, CachedRates>();

  constructor(private readonly config: ConfigService) {}

  /** Currencies the wallet knows how to display/convert. */
  getSupportedCurrencies(): readonly CurrencyCode[] {
    return SUPPORTED_CURRENCIES;
  }

  /** Converts `amount` from one currency to another using the live rate for the pair. */
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rate = await this.getRate(from, to);
    return amount * rate;
  }

  /** Returns the multiplier to convert an amount in `from` into `to`. */
  async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;
    const rates = await this.getRatesForBase(from);
    const rate = rates[to];
    if (!rate) throw new BadRequestException(`Exchange rate for ${from} to ${to} not found`);
    return rate;
  }

  /** Fetches (or returns the cached) rate table for `base`, falling back on failure. */
  private async getRatesForBase(base: string): Promise<Record<string, number>> {
    const ttlMs = Number(this.config.get<string>('EXCHANGE_RATE_CACHE_TTL_MS')) || 3_600_000;
    const cached = this.cache.get(base);
    if (cached && Date.now() - cached.fetchedAt < ttlMs) {
      return cached.rates;
    }

    try {
      const baseUrl = this.config.get<string>('EXCHANGE_RATE_API_BASE_URL', 'https://open.er-api.com/v6/latest');
      const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY');
      const url = `${baseUrl}/${base}${apiKey ? `?apikey=${apiKey}` : ''}`;

      const response = await fetch(url);
      const data = (await response.json()) as LiveRatesResponse;

      if (data.result !== 'success' || !data.rates) {
        throw new Error(`Unexpected exchange rate API response: ${JSON.stringify(data)}`);
      }

      const fresh: CachedRates = { rates: data.rates, fetchedAt: Date.now() };
      this.cache.set(base, fresh);
      return fresh.rates;
    } catch (err) {
      this.logger.warn(`Live exchange rate fetch failed for base ${base}: ${(err as Error).message}`);
      if (cached) {
        this.logger.warn(`Falling back to stale cached rates for base ${base}`);
        return cached.rates;
      }
      return this.getStaticFallbackRates(base);
    }
  }

  /** Last-resort static rate table (relative to USD), used only when live and cached rates are both unavailable. */
  private getStaticFallbackRates(base: string): Record<string, number> {
    const baseRate = FALLBACK_USD_RATES[base as CurrencyCode];
    if (!baseRate) throw new BadRequestException(`No fallback exchange rate available for base currency ${base}`);

    this.logger.warn(`Using static fallback exchange rates for base ${base}`);
    const rates: Record<string, number> = {};
    for (const [code, usdRate] of Object.entries(FALLBACK_USD_RATES)) {
      rates[code] = usdRate / baseRate;
    }
    return rates;
  }
}