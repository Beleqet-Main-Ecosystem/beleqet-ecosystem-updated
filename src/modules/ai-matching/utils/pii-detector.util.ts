/**
 * Detect whether a string contains an email address.
 *
 * @param text - The text to inspect.
 * @returns true when at least one email pattern is found.
 */
export function detectEmail(text: string): boolean {
  return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
}

/**
 * Detect whether a string contains a phone number.
 * Supports international formats including leading `+` and common separators.
 *
 * @param text - The text to inspect.
 * @returns true when at least one phone number pattern is found.
 */
export function detectPhone(text: string): boolean {
  return /\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}/.test(text);
}

/**
 * Detect whether a string contains a URL (http, https).
 *
 * @param text - The text to inspect.
 * @returns true when at least one URL pattern is found.
 */
export function detectUrl(text: string): boolean {
  return /https?:\/\/[^\s]+/.test(text);
}

/**
 * Check whether text contains any detected PII (email, phone, or URL).
 *
 * @param text - The text to inspect.
 * @returns true if any PII pattern is found.
 */
export function containsPotentialPii(text: string): boolean {
  return detectEmail(text) || detectPhone(text) || detectUrl(text);
}
