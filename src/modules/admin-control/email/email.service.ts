import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  EmailUserContext,
  EmailTemplatePayload,
  IMailableTransporter,
  ISecurityAuditLogger,
  GDPRConsentViolationException,
  DynamicTokens,
} from './email.types';
import { enDictionary } from './templates/en';
import { amDictionary } from './templates/am';

/**
 * @class EmailService
 * @description Enterprise-grade service for rendering and dispatching automated emails.
 * Integrates GDPR compliance checks, native i18n localization fallback, and multi-currency formatting.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly dictionaries: Record<string, typeof enDictionary> = {
    en: enDictionary,
    am: amDictionary,
  };

  /**
   * @constructor
   * @param transporter Network transport layer for sending mail via SMTP/API.
   * @param securityLogger Secure audit layer for logging compliance violations.
   */
  constructor(
    @Inject('IMailableTransporter') private readonly transporter: IMailableTransporter,
    @Inject('ISecurityAuditLogger') private readonly securityLogger: ISecurityAuditLogger,
  ) {}

  /**
   * Validates GDPR consent, processes localization/currency, interpolates tokens, and dispatches the email.
   *
   * @param user The contextual data of the recipient user.
   * @param payload The template requirement including type and dynamic parameters.
   * @returns A boolean representing successful network dispatch.
   * @throws GDPRConsentViolationException if a marketing email targets an opted-out user.
   */
  public async sendAutomatedEmail(user: EmailUserContext, payload: EmailTemplatePayload): Promise<boolean> {
    try {
      // 1. GDPR Privacy Wall Enforcement
      if (payload.templateType === 'NEWSLETTER' && !user.marketingProfile.hasConsentedToMarketing) {
        const breachDetails = `Unauthorized attempt to send NEWSLETTER to user [${user.id}] without marketing consent.`;
        this.securityLogger.logSecurityBreach(user.id, 'UNAUTHORIZED_MARKETING_DISPATCH', breachDetails);
        throw new GDPRConsentViolationException(breachDetails);
      }

      // 2. Localization Fallback Strategy
      const locale = this.dictionaries[user.locale] ? user.locale : 'en';
      const dictionary = this.dictionaries[locale];
      const template = dictionary[payload.templateType];

      if (!template) {
        throw new Error(`Template type [${payload.templateType}] not found in dictionary.`);
      }

      // 3. Multi-Currency Engine Processing
      let processedTokens = { ...payload.tokens };
      if (processedTokens.amount !== undefined) {
        processedTokens.formattedAmount = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: user.currency,
        }).format(Number(processedTokens.amount));
      }

      // 4. Token Interpolation (including default tokens like {name})
      const finalTokens: DynamicTokens = {
        name: user.name,
        unsubscribeUrl: `https://beleqet.com/unsubscribe?uid=${user.id}`,
        ...processedTokens,
      };

      const subject = this.compileAndInterpolate(template.subject, finalTokens);
      const body = this.compileAndInterpolate(template.body, finalTokens);

      // 5. Network Dispatch
      const result = await this.transporter.sendMail(user.email, subject, body);
      this.logger.log(`Successfully dispatched [${payload.templateType}] to [${user.email}]`);
      return result;

    } catch (error) {
      if (error instanceof GDPRConsentViolationException) {
        this.logger.error(`Security blocked email dispatch: ${error.message}`);
        throw error; // Re-throw security errors for the higher-level bounds to intercept
      }
      this.logger.error(`Failed to send email to [${user.email}]: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Safely interpolates a raw template string using matched tokens.
   *
   * @param template The raw string template (e.g. 'Hello {name}').
   * @param tokens The key-value record of strings to replace.
   * @returns The fully interpolated string ready for dispatch.
   */
  private compileAndInterpolate(template: string, tokens: DynamicTokens): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return tokens[key] !== undefined ? String(tokens[key]) : match;
    });
  }
}
