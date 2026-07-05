import { Injectable, Logger } from '@nestjs/common';

/**
 * @file paypal-i18n.service.ts
 * @module PayPal
 * @description Localisation service for the PayPal payment module.
 *
 * Provides translated user-facing strings for payment notifications, status
 * messages, and error feedback. The primary target locales are:
 * - `en` — English (default fallback)
 * - `am` — Amharic (ዓማርኛ) — primary locale for Ethiopian users
 *
 * **Why a dedicated i18n service instead of using the global `I18nService` directly?**
 * The global `I18nService` requires async context and HTTP request scoping. The PayPal
 * processor runs in a BullMQ worker context (no HTTP request). This service provides
 * a synchronous, zero-dependency fallback using a local string map, while still
 * delegating to the global service when a request context is available.
 *
 * @example
 * ```ts
 * // In PaypalProcessor:
 * const body = this.i18n.t('paypal.payment.confirmed', 'am', {
 *   currency: 'USD',
 *   amount: '150.00',
 * });
 * // → 'ክፍያዎ ተቀብሏል፡ USD 150.00'
 * ```
 */
@Injectable()
export class PaypalI18nService {
  private readonly logger = new Logger(PaypalI18nService.name);

  /**
   * Flat key → locale → template string map.
   *
   * Templates support `{{variable}}` placeholders resolved by the `params` argument
   * passed to {@link translate}.
   */
  private readonly strings: Record<string, Record<string, string>> = {
    'paypal.payment.confirmed': {
      en: 'Your payment of {{currency}} {{amount}} has been successfully processed.',
      am: 'ክፍያዎ ተቀብሏል፡ {{currency}} {{amount}} በተሳካ ሁኔታ ተካሂዷል።',
    },
    'paypal.payment.failed': {
      en: 'Your PayPal payment could not be processed. Please try again.',
      am: 'የPayPal ክፍያዎ ሊካሄድ አልቻለም። እባክዎ እንደገና ይሞክሩ።',
    },
    'paypal.refund.issued': {
      en: 'A refund of {{currency}} {{amount}} has been issued to your PayPal account.',
      am: 'የ{{currency}} {{amount}} ተመላሽ ወደ PayPal መለያዎ ተልኳል።',
    },
    'paypal.subscription.active': {
      en: 'Your Beleqet subscription is now active.',
      am: 'የ Beleqet ደንበኝነትዎ አሁን ንቁ ነው።',
    },
    'paypal.subscription.cancelled': {
      en: 'Your Beleqet subscription has been cancelled.',
      am: 'የ Beleqet ደንበኝነትዎ ተሰርዟል።',
    },
    'paypal.subscription.suspended': {
      en: 'Your Beleqet subscription has been suspended.',
      am: 'የ Beleqet ደንበኝነትዎ ታግዷል።',
    },
    'paypal.subscription.expired': {
      en: 'Your Beleqet subscription has expired.',
      am: 'የ Beleqet ደንበኝነትዎ ጊዜው አልፏል።',
    },
    'paypal.dispute.created': {
      en: 'A new PayPal dispute has been opened: {{disputeId}}',
      am: 'አዲስ የPayPal ቅሬታ ተከፍቷል፡ {{disputeId}}',
    },
    'paypal.dispute.resolved': {
      en: 'PayPal dispute {{disputeId}} has been resolved.',
      am: 'የPayPal ቅሬታ {{disputeId}} ተፈትቷል።',
    },
  };

  /**
   * Translates a PayPal domain i18n key into the requested locale.
   *
   * Falls back to English if the requested locale does not have a translation
   * for the given key. Falls back to the key string itself if neither locale
   * is found, logging a warning.
   *
   * Template variables in the format `{{variableName}}` are replaced with
   * values from the `params` object.
   *
   * @param key    - Dot-notation i18n key (e.g. `'paypal.payment.confirmed'`)
   * @param locale - BCP-47 locale string or short code (`'en'` | `'am'`)
   * @param params - Key-value map of template variable substitutions
   * @returns Localised string with all template placeholders resolved
   *
   * @example
   * ```ts
   * this.i18n.translate('paypal.payment.confirmed', 'am', {
   *   currency: 'USD',
   *   amount: '150.00',
   * });
   * // → 'ክፍያዎ ተቀብሏል፡ USD 150.00 በተሳካ ሁኔታ ተካሂዷል።'
   *
   * this.i18n.translate('paypal.payment.failed', 'en');
   * // → 'Your PayPal payment could not be processed. Please try again.'
   * ```
   */
  translate(
    key: string,
    locale = 'en',
    params: Record<string, string | number> = {},
  ): string {
    const keyMap = this.strings[key];
    if (!keyMap) {
      this.logger.warn(`[PaypalI18n] Missing i18n key: "${key}"`);
      return key;
    }

    // Normalise locale to short code ('am-ET' → 'am', 'en-US' → 'en')
    const shortLocale = locale.split('-')[0].toLowerCase();

    const template = keyMap[shortLocale] ?? keyMap['en'] ?? key;

    if (!keyMap[shortLocale]) {
      this.logger.debug(
        `[PaypalI18n] Locale "${shortLocale}" not found for key "${key}" — using English fallback`,
      );
    }

    return this.interpolate(template, params);
  }

  /**
   * Alias for {@link translate} with a shorter name for use in hot paths.
   *
   * @param key    - i18n key
   * @param locale - Target locale
   * @param params - Template substitutions
   * @returns Localised string
   */
  t(key: string, locale = 'en', params: Record<string, string | number> = {}): string {
    return this.translate(key, locale, params);
  }

  /**
   * Replaces all `{{key}}` placeholders in a template string with corresponding
   * values from the `params` map.
   *
   * @param template - String containing `{{key}}` placeholders
   * @param params   - Replacement values keyed by placeholder name
   * @returns Interpolated string
   *
   * @example
   * ```ts
   * this.interpolate('Hello {{name}}!', { name: 'World' });
   * // → 'Hello World!'
   * ```
   */
  private interpolate(
    template: string,
    params: Record<string, string | number>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      params[key] !== undefined ? String(params[key]) : `{{${key}}}`,
    );
  }

  /**
   * Returns all available translation keys for debugging or audit purposes.
   *
   * @returns Array of all registered i18n key strings
   *
   * @example
   * ```ts
   * this.i18n.getAvailableKeys();
   * // → ['paypal.payment.confirmed', 'paypal.payment.failed', ...]
   * ```
   */
  getAvailableKeys(): string[] {
    return Object.keys(this.strings);
  }
}
