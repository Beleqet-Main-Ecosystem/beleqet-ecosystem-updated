import type { LanguageCode, LocalizedText } from "@/portfolio/types";

/**
 * Creates an empty localized text object for all supported languages.
 *
 * @param value - Optional seed value applied to every locale.
 */
export function emptyLocalized(value = ""): LocalizedText {
  return { en: value, am: value };
}

/**
 * Reads localized text for the active language with English fallback.
 *
 * @param text - Bilingual field from master profile data.
 * @param locale - Active UI locale.
 */
export function readLocalized(
  text: LocalizedText,
  locale: LanguageCode,
): string {
  const primary = text[locale]?.trim();
  if (primary) return primary;
  return text.en?.trim() || text.am?.trim() || "";
}

/**
 * Updates one locale slot in a localized text field.
 *
 * @param text - Existing localized value.
 * @param locale - Locale to update.
 * @param value - New string value.
 */
export function setLocalized(
  text: LocalizedText,
  locale: LanguageCode,
  value: string,
): LocalizedText {
  return { ...text, [locale]: value };
}
