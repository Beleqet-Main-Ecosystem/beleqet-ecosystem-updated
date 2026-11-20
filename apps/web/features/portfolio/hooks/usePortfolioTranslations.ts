'use client';

import { useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';

/** The portfolio builder's UI strings: the `portfolio` section of locales/{en,am}.json. */
export function usePortfolioTranslations() {
  const { t: translate, locale, setLocale } = useTranslation();
  const t = useCallback((key: string) => translate(`portfolio.${key}`), [translate]);

  return { t, locale, setLocale };
}
