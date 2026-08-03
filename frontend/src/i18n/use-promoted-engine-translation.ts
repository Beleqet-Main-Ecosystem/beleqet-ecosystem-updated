'use client';

import { useEffect, useState } from 'react';
import { translatePromotedEngineMessage, type PromotedEngineMessageKey } from './promoted-engine-messages';

/**
 * Supplies browser-locale-aware labels while preserving an identical English
 * initial server/client render for hydration safety.
 *
 * @returns a typed translation function for Promoted Engine message keys
 */
export function usePromotedEngineTranslation(): {
  t: (key: PromotedEngineMessageKey, vars?: Record<string, string | number>) => string;
} {
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    setLocale(document.documentElement.lang);
  }, []);

  return {
    t: (key: PromotedEngineMessageKey, vars?: Record<string, string | number>): string =>
      translatePromotedEngineMessage(locale, key, vars),
  };
}