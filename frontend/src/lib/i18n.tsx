'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import en from '@/locales/en.json';
import am from '@/locales/am.json';

export type Locale = 'en' | 'am';
type Messages = Record<string, string>;

/** Same storage key as the website, so a chosen language carries over on this device. */
const LOCALE_KEY = 'beleqet_locale';

function flatten(input: object, prefix = '', out: Messages = {}): Messages {
  for (const [key, value] of Object.entries(input)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, path, out);
    else if (typeof value === 'string') out[path] = value;
  }
  return out;
}

const dictionaries: Record<Locale, Messages> = { en: flatten(en), am: flatten(am) };

/** Looks a key up in one locale, falling back to English, then the key; fills {name} slots. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (slot, name: string) => (name in vars ? String(vars[name]) : slot)) : text;
}

type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === 'am' || stored === 'en') setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LOCALE_KEY, next);
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
