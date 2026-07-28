'use client';

import { useEffect, useState } from 'react';
import { translateThemeMessage, type ThemeMessageKey } from './theme-messages';

/**
 * Supplies browser-locale-aware labels while preserving an identical English
 * initial server/client render for hydration safety.
 *
 * @returns a typed translation function for theme-control message keys
 */
export function useThemeTranslation(): { t: (key: ThemeMessageKey) => string } {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(document.documentElement.lang);
  }, []);

  return { t: (key: ThemeMessageKey): string => translateThemeMessage(locale, key) };
}
