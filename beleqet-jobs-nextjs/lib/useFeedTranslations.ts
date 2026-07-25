'use client';

import { useCallback, useEffect, useState } from 'react';

/** Languages supported by the AI Personal Feed page. */
export type FeedLocale = 'en' | 'am';

const STORAGE_KEY = 'feedLocale';

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
 * This is intentionally self-contained rather than pulling in a full i18n
 * framework (e.g. next-i18next): the AI Feed module owns only this one page,
 * and no i18n routing/library is set up elsewhere in the app yet. Adding a
 * project-wide i18n framework would touch shared config (`next.config.js`,
 * routing) well outside this module's scope — this hook keeps translation
 * concerns local to the feed feature, and can be swapped for a shared
 * solution later without changing the call sites (`t('key')`).
 *
 * Translations are loaded from static JSON files in `public/locales/{locale}/feed.json`,
 * fetched at runtime, with an in-memory English fallback so the page never
 * renders untranslated keys if the fetch fails.
 */
export function useFeedTranslations() {
  const [locale, setLocaleState] = useState<FeedLocale>('en');
  const [messages, setMessages] = useState<Record<string, string>>(FALLBACK_MESSAGES);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'am') {
      setLocaleState(stored);
    }
  }, []);

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

  const setLocale = useCallback((next: FeedLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  /** Translates a key, falling back to the key itself if missing. */
  const t = useCallback((key: string) => messages[key] ?? FALLBACK_MESSAGES[key] ?? key, [messages]);

  return { t, locale, setLocale };
}