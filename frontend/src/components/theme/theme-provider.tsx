'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getThemePreference, updateThemePreference } from '@/lib/api';
import {
  DARK_THEME_CLASS,
  THEME_COOKIE_KEY,
  THEME_STORAGE_KEY,
  type ThemePreference,
  parseThemePreference,
  resolvesToDark,
} from './theme-preference';

interface ThemeContextValue {
  preference: ThemePreference;
  isMounted: boolean;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Props accepted by the client-only theme provider. */
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Applies the resolved theme class without changing document dimensions.
 *
 * @param preference - selected preference to resolve
 */
function applyTheme(preference: ThemePreference): void {
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle(DARK_THEME_CLASS, resolvesToDark(preference, systemPrefersDark));
  document.documentElement.dataset.theme = preference;
}

/**
 * Caches a minimal preference locally and in a first-party cookie for a FOUC-free next paint.
 *
 * @param preference - preference that has just been selected
 */
function cacheTheme(preference: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, preference);
  document.cookie = `${THEME_COOKIE_KEY}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Provides FOUC-free, hydration-safe theme state and synchronises it with the
 * authenticated User Preferences API after the browser has mounted.
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>('SYSTEM');
  const [isMounted, setIsMounted] = useState(false);

  const setPreference = useCallback((nextPreference: ThemePreference): void => {
    setPreferenceState(nextPreference);
    applyTheme(nextPreference);
    cacheTheme(nextPreference);
    void updateThemePreference(nextPreference).catch(() => undefined);
  }, []);

  useEffect(() => {
    const cachedPreference = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
    if (cachedPreference) {
      setPreferenceState(cachedPreference);
      applyTheme(cachedPreference);
    }
    setIsMounted(true);

    void getThemePreference()
      .then(({ theme }) => {
        const serverPreference = parseThemePreference(theme);
        const currentCachedPreference = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
        if (!currentCachedPreference && serverPreference) {
          setPreferenceState(serverPreference);
          applyTheme(serverPreference);
          cacheTheme(serverPreference);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (): void => {
      if (preference === 'SYSTEM') applyTheme('SYSTEM');
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return (): void => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, isMounted, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Reads the current theme context.
 *
 * @returns hydrated theme state and mutation callback
 * @throws when rendered outside {@link ThemeProvider}
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider.');
  return context;
}
