import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
// The website's translations, so the app and the site say the same thing in both languages.
import webEn from '../../../beleqet-jobs-nextjs/locales/en.json';
import webAm from '../../../beleqet-jobs-nextjs/locales/am.json';
// Text only the app needs, under the "m." prefix.
import appEn from '../locales/en.json';
import appAm from '../locales/am.json';

export type Locale = 'en' | 'am';
type Dict = Record<string, unknown>;
type Vars = Record<string, string | number>;

const LOCALE_KEY = 'beleqet_locale';
const DICTS: Record<Locale, Dict[]> = {
  en: [appEn as Dict, webEn as Dict],
  am: [appAm as Dict, webAm as Dict, appEn as Dict, webEn as Dict],
};

function lookup(dict: Dict, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Dict)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Looks a key up in the active language, then English, then returns the key itself. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  let text = key;
  for (const dict of DICTS[locale]) {
    const found = lookup(dict, key);
    if (found !== undefined) {
      text = found;
      break;
    }
  }
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
  return text;
}

type I18n = { t: (key: string, vars?: Vars) => string; locale: Locale; setLocale: (locale: Locale) => void };
const I18nContext = createContext<I18n | null>(null);

function deviceLocale(): Locale {
  try {
    return getLocales()[0]?.languageCode === 'am' ? 'am' : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);

  useEffect(() => {
    SecureStore.getItemAsync(LOCALE_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'am') setLocaleState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    SecureStore.setItemAsync(LOCALE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useTranslation must be used inside I18nProvider');
  return value;
}
