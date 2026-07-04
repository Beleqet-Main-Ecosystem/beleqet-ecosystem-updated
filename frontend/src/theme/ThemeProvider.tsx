'use client';

import React, { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { THEME_PREFERENCE_VALUES } from './theme.types';

/**
 * Props accepted by {@link ThemeProvider}.
 */
export interface ThemeProviderProps {
  /** The app tree that should have access to the current theme. */
  children: ReactNode;
}

/**
 * ThemeProvider
 *
 * Root composition boundary for the Dark/Light Mode module.
 *
 * Rule 1 of the project README requires every feature to be wired to the
 * rest of the app through Dependency Injection rather than reaching into
 * globals directly. NestJS's DI container has no meaning on the client, so
 * this component is the frontend's equivalent: every part of the app that
 * needs the current theme or a way to change it consumes it through
 * `useTheme()` (see useTheme.ts) rather than touching `localStorage` or
 * `window.matchMedia` itself. `ThemeProvider` is the single place those
 * dependencies are constructed and handed down — swap what's inside this
 * component and every consumer gets the new behavior for free, which is
 * the same benefit DI gives the NestJS modules elsewhere in this repo.
 *
 * Configuration (which default theme new visitors see) is read from an
 * environment variable rather than hardcoded, per Rule 3 — see .env.example.
 *
 * @param props - See {@link ThemeProviderProps}.
 * @returns The app tree wrapped with theme context.
 */
export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const defaultTheme =
    process.env.NEXT_PUBLIC_DEFAULT_THEME &&
    (THEME_PREFERENCE_VALUES as readonly string[]).includes(
      process.env.NEXT_PUBLIC_DEFAULT_THEME,
    )
      ? process.env.NEXT_PUBLIC_DEFAULT_THEME
      : 'system';

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      // Prevents a flash of the wrong theme on first paint by disabling
      // next-themes' CSS transition suppression only for the very first
      // render; the toggle itself keeps its own smooth transition (see
      // ThemeToggle.tsx and the `transition-theme` utility in globals.css).
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
