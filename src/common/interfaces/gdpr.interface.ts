/**
 * Interface that enforces GDPR compliance properties on data models.
 * Any model containing user data must implement this interface to track processing consent.
 */
export interface GdprCompliant {
  /**
   * Boolean flag indicating if the user has consented to the processing of their personal data.
   */
  hasConsentedToProcessing: boolean;
}

/**
 * Utility class providing GDPR and data privacy helper functions,
 * including data masking for Personally Identifiable Information (PII).
 */
export class GdprUtil {
  /**
   * Sanitizes a text string by masking sensitive Personally Identifiable Information (PII)
   * such as emails and phone numbers.
   *
   * @param text - The raw string input that may contain sensitive user details.
   * @returns The masked string with sensitive information obfuscated.
   * @throws Error if the input parameter is not a string.
   * @security GDPR/PII Alert: This utility is specifically designed to protect data privacy
   *           by preventing sensitive PII from leaking into logs or application outputs.
   */
  static maskPII(text: string): string {
    if (typeof text !== 'string') {
      throw new Error('Input must be a valid string for masking.');
    }

    // Match and mask email addresses (e.g. bem...@domain.com)
    let sanitized = text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match: string, emailName: string, domain: string): string => {
      if (emailName.length <= 4) {
        return '****@' + domain;
      }
      return emailName.substring(0, 3) + '...' + emailName.slice(-1) + '@' + domain;
    });

    // Match and mask typical phone numbers (e.g. +251 912 345 678 -> +251 912 *** ***)
    sanitized = sanitized.replace(/(\+?[0-9\s-]{7,15})/g, (match: string): string => {
      const cleanDigits = match.replace(/[\s-]/g, '');
      // Only mask if it looks like a phone number (e.g., minimum 8 digits)
      if (cleanDigits.length >= 8) {
        const visibleLength = Math.max(3, cleanDigits.length - 6);
        return match.substring(0, visibleLength) + '***' + match.slice(-3);
      }
      return match;
    });

    return sanitized;
  }
}
