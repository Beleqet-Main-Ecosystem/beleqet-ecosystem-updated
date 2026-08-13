'use client';

import * as React from 'react';
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from 'next-themes';
import { THEME_STORAGE_KEY } from '@/lib/theme';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  enableSystem = false,
  storageKey = THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      {...props}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      storageKey={storageKey}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const theme = useNextTheme();

  const setTheme = React.useCallback(
    (value: string) => {
      theme.setTheme(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(THEME_STORAGE_KEY, value);
      }
    },
    [theme],
  );

  return { ...theme, setTheme };
}
