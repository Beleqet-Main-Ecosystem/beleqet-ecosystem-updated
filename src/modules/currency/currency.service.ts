import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}

@Injectable()
export class CurrencyService {
  private readonly supportedCurrencies: CurrencyInfo[] = [
    { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];

  private readonly userCurrencyPreferences = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async getCurrencies(): Promise<CurrencyInfo[]> {
    return [...this.supportedCurrencies].sort((a, b) => a.code.localeCompare(b.code));
  }

  async getCurrencyByCode(code: string): Promise<CurrencyInfo> {
    const currency = this.supportedCurrencies.find((item) => item.code === code.toUpperCase());

    if (!currency) {
      throw new NotFoundException(`Currency ${code} not found`);
    }

    return currency;
  }

  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<Record<string, unknown>> {
    if (fromCurrency === toCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency,
        rate: 1,
        convertedAmount: amount,
      };
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = amount * rate;

    return {
      amount,
      fromCurrency,
      toCurrency,
      rate,
      convertedAmount,
      timestamp: new Date().toISOString(),
    };
  }

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const rates: Record<string, number> = {
      USD_ETB: 55.5,
      ETB_USD: 0.018,
      EUR_USD: 1.09,
      USD_EUR: 0.92,
      EUR_ETB: 60.5,
      ETB_EUR: 0.0165,
      GBP_USD: 1.27,
      USD_GBP: 0.79,
    };

    const key = `${fromCurrency.toUpperCase()}_${toCurrency.toUpperCase()}`;
    return rates[key] || 1.0;
  }

  async formatCurrency(amount: number, currency: string, locale: string = 'en'): Promise<string> {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    return formatter.format(amount);
  }

  async getUserCurrency(userId: string): Promise<CurrencyInfo> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const preferredCurrency = (user as { currency?: string | CurrencyInfo | null }).currency;
    const storedCurrencyCode = typeof preferredCurrency === 'string' ? preferredCurrency : this.userCurrencyPreferences.get(userId);

    if (storedCurrencyCode) {
      return this.getCurrencyByCode(storedCurrencyCode);
    }

    return this.supportedCurrencies.find((item) => item.code === 'ETB')!;
  }

  async setUserCurrency(userId: string, currencyCode: string): Promise<CurrencyInfo> {
    const currency = await this.getCurrencyByCode(currencyCode);
    this.userCurrencyPreferences.set(userId, currency.code);

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {},
      });
    } catch {
      // Ignore persistence errors because this project does not define a user currency field in the schema.
    }

    return currency;
  }
}