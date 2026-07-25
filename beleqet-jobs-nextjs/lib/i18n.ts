import { useState, useEffect } from 'react';
import en from '../locales/en.json';
import am from '../locales/am.json';

export type Locale = 'en' | 'am';
export type Dictionary = typeof en;

/**
 * Hook providing translation values and language toggle features in the frontend client.
 *
 * @returns Object containing active locale, changeLanguage setter, and t() translation function.
 * @security GDPR/Consent: None. No personal data processed by i18n lookup.
 */
export function useTranslation() {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem('beleqet_locale') as Locale;
    if (saved === 'en' || saved === 'am') {
      setLocale(saved);
    }
  }, []);

  /**
   * Sets the active translation locale and persists it in localStorage.
   *
   * @param newLocale - Target locale tag ('en' or 'am').
   * @security None.
   */
  const changeLanguage = (newLocale: Locale): void => {
    setLocale(newLocale);
    localStorage.setItem('beleqet_locale', newLocale);
  };

  const dictionary: Dictionary = locale === 'en' ? en : am;

  /**
   * Resolves a nested key in the translation dictionary using dot notation paths.
   *
   * @param path - Dot-notation path to the key (e.g. 'storage.title').
   * @returns The localized string representation, or the query path itself if missing.
   * @security GDPR/Consent: None.
   */
  const t = (path: string): string => {
    const keys = path.split('.');
    let current: unknown = dictionary;

    for (const key of keys) {
      if (current && typeof current === 'object' && current !== null && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return path;
      }
    }

    return typeof current === 'string' ? current : path;
  };

  return {
    locale,
    changeLanguage,
    t,
  };
}
