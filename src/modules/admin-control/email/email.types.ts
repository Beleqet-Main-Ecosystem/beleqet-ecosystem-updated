/**
 * @fileoverview Defines the strict data contracts, types, and security
 * exceptions for the Beleqet Ecosystem Email Automation service.
 */

/**
 * Represents the marketing consent status and preference configuration of a user.
 */
export interface UserMarketingProfile {
  hasConsentedToMarketing: boolean;
}

/**
 * Encapsulates necessary user contextual data required to dispatch localized
 * and compliant email templates.
 */
export interface EmailUserContext {
  id: string;
  name: string;
  email: string;
  locale?: string; // e.g. 'en', 'am', 'fr'. Optional to test fallback.
  currency: string; // e.g. 'ETB', 'USD', 'EUR'
  marketingProfile: UserMarketingProfile;
}

/**
 * The allowable types of automated email templates.
 */
export type EmailTemplateType = 'WELCOME' | 'PASSWORD_RESET' | 'PAYMENT_RECEIPT' | 'NEWSLETTER';

/**
 * A generalized structure for dynamic template tokens.
 */
export type DynamicTokens = Record<string, string | number>;

/**
 * Contains the execution details needed for rendering and dispatching a target template.
 */
export interface EmailTemplatePayload {
  templateType: EmailTemplateType;
  tokens?: DynamicTokens;
}

/**
 * Defines the contract for sending the actual email bytes over a network transport layer.
 */
export interface IMailableTransporter {
  sendMail(to: string, subject: string, htmlBody: string): Promise<boolean>;
}

/**
 * Defines the contract for securely logging unauthorized access or compliance breaches.
 */
export interface ISecurityAuditLogger {
  logSecurityBreach(userId: string, targetAction: string, details: string): void;
}

/**
 * Thrown when a user without explicit marketing consent is targeted for promotional streams.
 */
export class GDPRConsentViolationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GDPRConsentViolationException';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
