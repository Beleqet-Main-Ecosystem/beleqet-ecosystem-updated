import { Injectable } from '@nestjs/common';

/** Maps app locale codes to BCP 47 locale tags used by Intl APIs. */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  am: 'am-ET',
  ar: 'ar-SA',
  fr: 'fr-FR',
};

/** Maps app locale codes to their default ISO 4217 currency codes. */
const CURRENCY_MAP: Record<string, string> = {
  en: 'USD',
  am: 'ETB',
  ar: 'SAR',
  fr: 'EUR',
};

/**
 * Provides locale-aware formatting for numbers, currencies, and dates.
 * All methods are pure and stateless — safe to use across concurrent requests.
 */
@Injectable()
export class LocaleFormatterService {
  /**
   * Resolves a BCP 47 locale tag from an app locale code.
   * Falls back to 'en-US' for unknown codes.
   * @param lang - App locale code (e.g. 'am', 'ar')
   */
  private resolveLocale(lang: string): string {
    return LOCALE_MAP[lang] ?? 'en-US';
  }

  /**
   * Formats a number according to the given locale.
   * @param value - The numeric value to format
   * @param lang  - App locale code
   * @returns Locale-formatted number string
   */
  formatNumber(value: number, lang: string): string {
    return new Intl.NumberFormat(this.resolveLocale(lang)).format(value);
  }

  /**
   * Formats a monetary amount with the locale's default currency.
   * Supports an optional currency override (ISO 4217).
   * @param amount   - The monetary amount
   * @param lang     - App locale code
   * @param currency - Optional ISO 4217 currency code override
   * @returns Locale-formatted currency string
   */
  formatCurrency(amount: number, lang: string, currency?: string): string {
    const resolvedCurrency = currency ?? CURRENCY_MAP[lang] ?? 'USD';
    return new Intl.NumberFormat(this.resolveLocale(lang), {
      style: 'currency',
      currency: resolvedCurrency,
    }).format(amount);
  }

  /**
   * Formats a date according to the given locale.
   * @param date    - Date instance or ISO date string
   * @param lang    - App locale code
   * @param options - Optional Intl.DateTimeFormatOptions overrides
   * @returns Locale-formatted date string
   */
  formatDate(
    date: Date | string,
    lang: string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(this.resolveLocale(lang), {
      dateStyle: 'medium',
      ...options,
    }).format(d);
  }
}
