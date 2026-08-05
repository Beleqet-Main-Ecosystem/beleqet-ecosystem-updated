'use client';

import { useEffect, useState } from 'react';
import { translateMatchingMessage, type MatchingMessageKey } from './matching-messages';

/**
 * Supplies browser-locale-aware labels while preserving an identical English
 * initial server/client render for hydration safety.
 *
 * @returns a typed translation function for Matchmaker message keys
 */
export function useMatchingTranslation(): {
  t: (key: MatchingMessageKey, vars?: Record<string, string | number>) => string;
} {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(document.documentElement.lang);
  }, []);

  return {
    t: (key: MatchingMessageKey, vars?: Record<string, string | number>): string =>
      translateMatchingMessage(locale, key, vars),
  };
}