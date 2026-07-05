import { BadRequestException, Injectable } from '@nestjs/common';
import { WalletService } from '../../wallet/wallet.service';

/** Supported display currencies for FAQ answers. */
export type SupportedCurrency = 'ETB' | 'USD' | 'EUR';

/**
 * Formats monetary FAQ answers with multi-currency support.
 * Reuses WalletService exchange rates for consistency across the platform.
 */
@Injectable()
export class FaqBotCurrencyService {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Convert an amount between currencies using platform exchange rates.
   * @param amount - Amount in source currency (minor units / whole numbers per platform convention)
   * @param from - Source currency code
   * @param to - Target currency code
   */
  convert(amount: number, from: SupportedCurrency, to: SupportedCurrency): number {
    if (from === to) return amount;
    try {
      return this.walletService.convertCurrency(amount, from, to);
    } catch {
      throw new BadRequestException(`Currency conversion from ${from} to ${to} is not supported`);
    }
  }

  /**
   * Format a monetary value for display in the user's preferred currency.
   * @param amountEtb - Base amount in ETB
   * @param locale - BCP-47 locale tag
   * @param currency - Target currency
   */
  formatAmount(amountEtb: number, locale: string, currency: SupportedCurrency): string {
    const converted =
      currency === 'ETB' ? amountEtb : this.convert(amountEtb, 'ETB', currency);
    const localeTag = locale === 'am' ? 'am-ET' : 'en-ET';
    return new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'ETB' ? 0 : 2,
    }).format(converted);
  }

  /**
   * Build currency context string injected into AI prompts for wallet-related FAQs.
   * @param locale - User locale
   * @param preferredCurrency - User-selected currency
   */
  buildCurrencyContext(locale: string, preferredCurrency: SupportedCurrency): string {
    const minWithdrawalEtb = 1;
    const platformFeePercent = 5;
    const minFormatted = this.formatAmount(minWithdrawalEtb, locale, preferredCurrency);
    return [
      'Currency reference (use when answering payment questions):',
      `- Minimum withdrawal: ${minFormatted} (base: 1 ETB)`,
      `- Platform escrow fee: ${platformFeePercent}%`,
      `- Supported currencies: ETB, USD, EUR`,
    ].join('\n');
  }
}
