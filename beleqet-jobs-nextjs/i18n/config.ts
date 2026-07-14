/**
 * Supported locales for the application (BCP-47 tags).
 *
 * Add new locale codes here to enable additional language support.
 * The `Locale` union type is derived from this array, so TypeScript
 * will enforce valid locale values everywhere in the codebase.
 */
export const locales = ["en", "am"] as const;

/**
 * The locale used when the user has no stored preference and the
 * browser's `Accept-Language` header does not match any supported locale.
 */
export const defaultLocale = "en" as const;

/**
 * Union type of all valid locale codes derived from the `locales` array.
 *
 * @example
 * const lang: Locale = "am"; // valid
 * const lang: Locale = "fr"; // TypeScript error
 */
export type Locale = (typeof locales)[number];
