'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

/** Languages supported by the AI Personal Feed page. */
export type FeedLocale = 'en' | 'am';

const FALLBACK_MESSAGES: Record<string, string> = {
  title: 'Your Personalized Job Feed',
  subtitle: 'Based on your searches, skills, and saved jobs.',
  managePrivacy: 'Manage privacy settings',
  refresh: 'Refresh recommendations',
  refreshing: 'Refreshing…',
  loading: 'Loading recommendations…',
  noJobs: 'No matching jobs found yet.',
  loginPrompt: 'Please log in to see your personalized job feed.',
  login: 'log in',
};

/**
 * Lightweight i18n hook for the `/feed` page.
 *
 * Page copy is loaded from `public/locales/{locale}/feed.json`, while the
 * active language is the shared app locale from {@link useTranslation} so
 * the header toggle applies on this page too.
 */
export function useFeedTranslations() {
  const { locale, setLocale } = useTranslation();
  const [messages, setMessages] = useState<Record<string, string>>(FALLBACK_MESSAGES);

  useEffect(() => {
    let cancelled = false;

    fetch(`/locales/${locale}/feed.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('locale fetch failed'))))
      .then((data: Record<string, string>) => {
        if (!cancelled) setMessages(data);
      })
      .catch(() => {
        if (!cancelled && locale === 'en') setMessages(FALLBACK_MESSAGES);
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  /** Translates a key, falling back to the key itself if missing. */
  const t = useCallback(
    (key: string) => messages[key] ?? FALLBACK_MESSAGES[key] ?? key,
    [messages],
  );

  return { t, locale, setLocale };
}
