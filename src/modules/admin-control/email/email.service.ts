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
   * Verifies the template compilation system and transport configuration.
   * @returns An object indicating the health status of the module.
   */
  public async checkHealth(): Promise<{
    status: string;
    templatesLoaded: boolean;
    transporterReady: boolean;
  }> {
    return {
      status: 'ok',
      templatesLoaded: Object.keys(this.dictionaries).length > 0,
      transporterReady: this.transporter !== undefined && this.transporter !== null,
    };
  }

  /**
   * Validates GDPR consent, processes localization/currency, interpolates tokens, and dispatches the email.
   *
   * @param user The contextual data of the recipient user.
   * @param payload The template requirement including type and dynamic parameters.
   * @returns A boolean representing successful network dispatch.
   * @throws GDPRConsentViolationException if a marketing email targets an opted-out user.
   */
  public async sendAutomatedEmail(
    user: EmailUserContext,
    payload: EmailTemplatePayload,
  ): Promise<boolean> {
    try {
      // 1. GDPR Privacy Shield Evaluation
      if (
        payload.templateType === 'NEWSLETTER' &&
        user.marketingProfile.hasConsentedToMarketing === false
      ) {
        const breachDetails = `Unauthorized attempt to send NEWSLETTER to user [${user.id}] without marketing consent.`;
        this.securityLogger.logSecurityBreach(
          user.id,
          'UNAUTHORIZED_MARKETING_DISPATCH',
          breachDetails,
        );
        throw new GDPRConsentViolationException(breachDetails);
      }

      // 2. Localization & Silent Fallback Strategy
      // If user.locale is null, undefined, or missing from the map, it gracefully falls back to 'en'
      const localeKey = user.locale && this.dictionaries[user.locale] ? user.locale : 'en';
      const dictionary = this.dictionaries[localeKey];
      const template = dictionary[payload.templateType];

      if (!template) {
        throw new Error(`Template type [${payload.templateType}] not found in dictionary.`);
      }

      // 3. Native Multi-Currency Formatting Engine
      const processedTokens = { ...payload.tokens };
      if (processedTokens.amount !== undefined) {
        processedTokens.formattedAmount = new Intl.NumberFormat(localeKey, {
          style: 'currency',
          currency: user.currency,
        }).format(Number(processedTokens.amount));
      }

      // 4. Zero-Placeholder Token Interpolation Engine
      const sanitizedName = user.name && user.name.trim() ? user.name.trim() : 'Valued User';
      const finalTokens: DynamicTokens = {
        name: sanitizedName,
        unsubscribeUrl: `https://beleqet.com/unsubscribe?uid=${user.id}`,
        ...processedTokens,
      };

      const subject = this.compileAndInterpolate(template.subject, finalTokens);
      const body = this.compileAndInterpolate(template.body, finalTokens);

      // 5. Network Dispatch Framework Integration with Exponential Backoff
      let attempts = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;
      const maskedEmail = this.maskEmail(user.email);

      while (attempts < maxRetries) {
        try {
          const result = await this.transporter.sendMail(user.email, subject, body);
          this.logger.log(
            `Successfully dispatched [${payload.templateType}] to [${maskedEmail}] on attempt ${attempts + 1}`,
          );
          return result;
        } catch (transportError) {
          attempts++;
          lastError = transportError as Error;
          if (attempts < maxRetries) {
            const delayMs = 100 * Math.pow(2, attempts - 1); // 100ms, 200ms
            await new Promise((res) => setTimeout(res, delayMs));
          }
        }
      }

      throw lastError;
    } catch (error) {
      if (error instanceof GDPRConsentViolationException) {
        this.logger.error(`Security Block Trace: ${error.message}`);
        throw error; // Re-throw to fail the terminal trace
      }
      this.logger.error(
        `Failed to send email to [${this.maskEmail(user.email)}]: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Safely interpolates a raw template string using matched RegExp tokens.
   * Cleans missing placeholders so unpopulated tokens don't leak raw markup.
   *
   * @param template The raw string template (e.g. 'Hello {name}').
   * @param tokens The key-value record of strings to replace.
   * @returns The fully interpolated string ready for dispatch.
   */
  private compileAndInterpolate(template: string, tokens: DynamicTokens): string {
    return template
      .replace(/\{(\w+)\}/g, (_match, key) => {
        return tokens[key] !== undefined && tokens[key] !== null ? String(tokens[key]) : '';
      })
      .replace(/\s+,/g, ',');
  }

  /**
   * Masks email address to protect PII in application log output.
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***@***';
    const [local, domain] = email.split('@');
    const maskedLocal =
      local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
    return `${maskedLocal}@${domain}`;
  }
}
