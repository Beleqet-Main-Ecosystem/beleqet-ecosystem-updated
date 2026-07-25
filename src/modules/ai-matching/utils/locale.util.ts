const DEFAULT_LOCALE = 'en';

/**
 * Normalize a locale string: trim whitespace, lowercase.
 * Falls back to the default locale ("en") when the input is empty or undefined.
 *
 * @param locale - Raw locale string (e.g., " EN ", "EN").
 * @returns Normalized lowercase locale (e.g., "en").
 */
export function normalizeLocale(locale?: string): string {
  if (!locale || locale.trim().length === 0) {
    return DEFAULT_LOCALE;
  }
  return locale.trim().toLowerCase();
}

/**
 * Check whether a locale is present in the supported list.
 *
 * @param locale - The locale to check (should be normalized first).
 * @param supportedLocales - List of supported locale codes.
 * @returns true if the locale exists in the list.
 */
export function isSupportedLocale(locale: string, supportedLocales: readonly string[]): boolean {
  return supportedLocales.includes(locale);
}
