/**
 * @fileoverview Internationalization (i18n) service for global scaling
 * @module webhooks/services
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalizationContext } from '../types/webhook.types';

/**
 * Service for handling internationalization and localization
 * Supports multi-language, multi-currency, and timezone handling
 *
 * @class I18nService
 */
@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  // Supported locales and currencies
  private readonly supportedLocales = ['en', 'es', 'fr', 'de', 'am', 'ar', 'pt', 'ja', 'zh'];

  private readonly currencyMap: Record<string, { symbol: string; locale: string }> = {
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    JPY: { symbol: '¥', locale: 'ja-JP' },
    CNY: { symbol: '¥', locale: 'zh-CN' },
    ETB: { symbol: 'Br', locale: 'am-ET' }, // Ethiopian Birr
    NGN: { symbol: '₦', locale: 'en-NG' }, // Nigerian Naira
    ZAR: { symbol: 'R', locale: 'en-ZA' }, // South African Rand
  };

  private readonly timezoneMap: Record<string, string> = {
    'US': 'America/New_York',
    'UK': 'Europe/London',
    'FR': 'Europe/Paris',
    'DE': 'Europe/Berlin',
    'ET': 'Africa/Addis_Ababa',
    'NG': 'Africa/Lagos',
    'JP': 'Asia/Tokyo',
    'CN': 'Asia/Shanghai',
    'IN': 'Asia/Kolkata',
    'AU': 'Australia/Sydney',
  };

  private readonly messages: Record<string, Record<string, string>> = {
    en: {
      'payment.success': 'Payment successful! Your account has been credited.',
      'payment.failed': 'Payment processing failed. Please try again.',
      'payment.refunded': 'Your payment has been refunded successfully.',
      'payment.disputed': 'Your payment is under dispute review.',
      'subscription.created': 'Your subscription is now active.',
      'subscription.cancelled': 'Your subscription has been cancelled.',
      'payment.amount': 'Amount',
      'payment.currency': 'Currency',
      'payment.date': 'Date',
      'payment.id': 'Transaction ID',
    },
    es: {
      'payment.success': '¡El pago fue exitoso! Su cuenta ha sido acreditada.',
      'payment.failed': 'El procesamiento del pago falló. Inténtelo de nuevo.',
      'payment.refunded': 'Su pago ha sido reembolsado exitosamente.',
      'payment.disputed': 'Su pago está bajo revisión de disputa.',
      'subscription.created': 'Su suscripción ahora está activa.',
      'subscription.cancelled': 'Su suscripción ha sido cancelada.',
    },
    fr: {
      'payment.success': 'Paiement réussi! Votre compte a été crédité.',
      'payment.failed': 'Le traitement du paiement a échoué. Veuillez réessayer.',
      'payment.refunded': 'Votre paiement a été remboursé avec succès.',
      'payment.disputed': 'Votre paiement est en cours d\'examen en cas de litige.',
      'subscription.created': 'Votre abonnement est maintenant actif.',
      'subscription.cancelled': 'Votre abonnement a été annulé.',
    },
    am: {
      'payment.success': 'ክፍያ ስኬታማ ነበር! የእርስዎ ሂሳብ ተመዝግቦ ነው።',
      'payment.failed': 'ክፍያ ሂደት ወደ ፍርድ አልተሳካም። እንደገና ሞክር።',
      'payment.refunded': 'የእርስዎ ክፍያ በተሳካ ሁኔታ ወደ ጀርባ ተመልሷል።',
      'payment.disputed': 'የእርስዎ ክፍያ በጉዳይ ግምገማ ላይ ነው።',
      'subscription.created': 'የእርስዎ ንዋይ አሁን ንቁ ነው።',
      'subscription.cancelled': 'የእርስዎ ንዋይ ተሰርዟል።',
    },
  };

  constructor(private configService: ConfigService) {}

  /**
   * Get localization context for user
   *
   * @param userId - User ID
   * @param defaultLocale - Default locale (fallback)
   * @returns LocalizationContext
   */
  async getLocalizationContext(
    userId: string,
    defaultLocale: string = 'en',
  ): Promise<LocalizationContext> {
    // In production, fetch user preferences from database
    const userLocale = this.isSupportedLocale(defaultLocale) ? defaultLocale : 'en';
    const timezone = this.getTimezoneByLocale(userLocale);
    const currency = this.getCurrencyByLocale(userLocale);

    return {
      locale: userLocale,
      timezone,
      currency,
      currencySymbol: this.currencyMap[currency]?.symbol || currency,
    };
  }

  /**
   * Translate message to specific locale
   *
   * @param messageKey - Message key
   * @param locale - Target locale
   * @param replacements - Variable replacements
   * @returns Translated message
   */
  translate(
    messageKey: string,
    locale: string = 'en',
    replacements?: Record<string, string | number>,
  ): string {
    const normalizedLocale = this.isSupportedLocale(locale) ? locale : 'en';
    const message = this.messages[normalizedLocale]?.[messageKey] || 
                   this.messages['en'][messageKey] || 
                   messageKey;

    if (!replacements) {
      return message;
    }

    let result = message;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return result;
  }

  /**
   * Format currency amount for display
   *
   * @param amount - Amount to format
   * @param currency - Currency code (e.g., USD, EUR, ETB)
   * @param locale - Locale for number formatting
   * @returns Formatted string
   */
  formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en'): string {
    try {
      const intl = new Intl.NumberFormat(this.getIntlLocale(locale), {
        style: 'currency',
        currency,
      });
      return intl.format(amount);
    } catch {
      // Fallback formatting
      return `${this.currencyMap[currency]?.symbol || currency} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Format date/time according to locale and timezone
   *
   * @param date - Date to format
   * @param locale - Locale
   * @param timezone - Timezone
   * @returns Formatted date string
   */
  formatDateTime(date: Date, locale: string = 'en', timezone?: string): string {
    try {
      const intl = new Intl.DateTimeFormat(this.getIntlLocale(locale), {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      return intl.format(date);
    } catch {
      return date.toISOString();
    }
  }

  /**
   * Get currency for specific locale/country
   *
   * @private
   */
  private getCurrencyByLocale(locale: string): string {
    const currencyMap: Record<string, string> = {
      en: 'USD',
      es: 'EUR',
      fr: 'EUR',
      de: 'EUR',
      am: 'ETB', // Amharic - Ethiopia
      ar: 'USD', // Arabic - varies by region
      pt: 'EUR', // Portuguese - often Europe
      ja: 'JPY',
      zh: 'CNY',
    };
    return currencyMap[locale.split('-')[0]] || 'USD';
  }

  /**
   * Get timezone for locale
   *
   * @private
   */
  private getTimezoneByLocale(locale: string): string {
    const countryCode = locale.split('-')[1] || '';
    return this.timezoneMap[countryCode] || 'UTC';
  }

  /**
   * Check if locale is supported
   *
   * @private
   */
  private isSupportedLocale(locale: string): boolean {
    return this.supportedLocales.includes(locale.split('-')[0]);
  }

  /**
   * Convert locale to Intl format
   *
   * @private
   */
  private getIntlLocale(locale: string): string {
    const localeMap: Record<string, string> = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      am: 'am-ET',
      ar: 'ar-SA',
      pt: 'pt-BR',
      ja: 'ja-JP',
      zh: 'zh-CN',
    };
    return localeMap[locale.split('-')[0]] || 'en-US';
  }

  /**
   * Get all supported locales
   */
  getSupportedLocales(): string[] {
    return this.supportedLocales;
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return Object.keys(this.currencyMap);
  }
}
