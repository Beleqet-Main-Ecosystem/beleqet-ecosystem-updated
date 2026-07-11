'use client';

/**
 * @file ThemeProvider.tsx
 * @description
 * React context provider for managing dark/light theme state.
 * Persists theme preference in localStorage and responds to system preference changes.
 *
 * Features:
 * - Toggles between dark, light, and system themes
 * - Persists selected theme in localStorage
 * - Responds to system preference changes when set to "system"
 * - Prevents flash of unstyled content (FOUC) with blocking script
 *
 * GDPR notes:
 *  - Theme preference is stored in localStorage (user-controlled)
 *  - No personal data is collected or transmitted
 */
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Hook to access the theme context.
 * Throws error if used outside ThemeProvider.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

/**
 * ThemeProvider component that manages theme state and persistence.
 *
 * @param children - Child components to be wrapped
 * @param defaultTheme - Initial theme (default: 'system')
 * @param storageKey - localStorage key for persistence (default: 'beleqet-theme')
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'beleqet-theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey) as Theme;
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  /**
   * Updates the theme state and persists to localStorage.
   */
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
  };

  /**
   * Updates the actual theme (dark/light) based on current theme setting.
   * If theme is 'system', uses system preference.
   */
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme: 'dark' | 'light';

    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      effectiveTheme = theme;
    }

    root.classList.add(effectiveTheme);
    setActualTheme(effectiveTheme);
  }, [theme]);

  /**
   * Listens for system preference changes when theme is set to 'system'.
   */
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const effectiveTheme = e.matches ? 'dark' : 'light';
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
      setActualTheme(effectiveTheme);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
