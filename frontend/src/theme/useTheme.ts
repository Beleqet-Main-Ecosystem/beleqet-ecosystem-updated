'use client';

import { useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { ThemePreference } from './theme.types';
import { isValidThemePreference } from './theme-preference.dto';

/**
 * Return shape of {@link useTheme}.
 */
export interface UseThemeResult {
  /** The user's stored preference — `'light' | 'dark' | 'system'`. */
  preference: ThemePreference;
  /** The preference actually being rendered right now (`'system'` resolved to light/dark). */
  resolvedPreference: 'light' | 'dark' | undefined;
  /** Updates the preference and persists it (via next-themes -> localStorage). */
  setPreference: (next: ThemePreference) => void;
  /** True once past the client-only mount pass — safe to render theme-dependent UI without a hydration mismatch. */
  isReady: boolean;
}

/**
 * useTheme
 *
 * Thin, strictly-typed wrapper around `next-themes`' `useTheme()`.
 *
 * This is the single point where every consumer in the app reads or
 * changes the theme — components never import `next-themes` directly,
 * which keeps the third-party dependency swappable behind one boundary
 * (see the TSDoc on {@link ThemeProvider} for why that matters for Rule 1).
 *
 * It also re-validates whatever `next-themes` reports as the current
 * theme through {@link isValidThemePreference} before trusting it, since
 * the underlying value ultimately comes from `localStorage`, which is
 * outside TypeScript's type system and could have been edited by hand.
 *
 * @returns See {@link UseThemeResult}.
 */
export function useTheme(): UseThemeResult {
  const { theme, resolvedTheme, setTheme, systemTheme } = useNextTheme();

  /**
   * `next-themes` reads `localStorage` synchronously as soon as it renders
   * on the client, so `theme` can already be resolved on the browser's
   * very first render pass — while the server (which has no
   * `localStorage`) always renders it as `undefined`. Comparing against
   * `theme` directly to decide "is this ready to show" therefore differs
   * between server output and the client's first paint, which is exactly
   * what triggers a hydration mismatch.
   *
   * `useEffect` never runs during SSR or during the initial client
   * hydration pass — only in a browser-only pass afterwards — so using it
   * to flip `mounted` guarantees the server and the client's first render
   * produce identical output, and the "real" theme only appears one tick
   * later, safely after hydration has already completed.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const validatedPreference = isValidThemePreference(theme) ?? 'system';
  const resolvedPreference =
    resolvedTheme === 'dark' || resolvedTheme === 'light'
      ? resolvedTheme
      : systemTheme === 'dark' || systemTheme === 'light'
        ? systemTheme
        : undefined;

  /**
   * Updates the theme preference after validating it, ignoring anything
   * that isn't a recognized {@link ThemePreference} instead of persisting
   * bad data.
   */
  function setPreference(next: ThemePreference): void {
    const validated = isValidThemePreference(next);
    if (validated) {
      setTheme(validated);
    }
  }

  return {
    preference: validatedPreference,
    resolvedPreference,
    setPreference,
    // `isReady` reflects whether we're past the client-only mount pass
    // (see the comment above `mounted`) — not whether `theme` happens to
    // be defined, since that's what caused the hydration mismatch.
    isReady: mounted,
  };
}
