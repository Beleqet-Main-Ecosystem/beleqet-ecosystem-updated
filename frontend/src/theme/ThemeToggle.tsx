'use client';

import React from 'react';
import { useTheme } from './useTheme';
import { getThemeLabels } from './i18n/theme.i18n';
import { ThemeLocale } from './theme.types';

/**
 * Props accepted by {@link ThemeToggle}.
 */
export interface ThemeToggleProps {
  /**
   * UI locale for the toggle's visible labels.
   * Defaults to `'en'`. See i18n/theme.i18n.ts for scope notes.
   */
  locale?: ThemeLocale;
}

/**
 * ThemeToggle
 *
 * The user-facing switch for the Dark/Light Mode module. A simple two-state
 * switch — Light <-> Dark — always showing the *current* choice as its
 * label so the state is never ambiguous to a screen-reader user or a
 * sighted user glancing at it.
 *
 * Note: there is no third "System" option on this switch. The system's
 * `prefers-color-scheme` is still used automatically the very first time
 * a visitor arrives with no saved preference (see ThemeProvider.tsx,
 * `enableSystem`) — that satisfies the task's "adapt to the system's
 * default preference" requirement. Once resolved to light or dark for
 * display, though, the toggle itself only ever offers those two choices,
 * matching in the same way OS-level dark mode switches usually work.
 *
 * Accessibility / WCAG notes:
 * - Rendered as a real `<button>` (not a `<div>`), so it's keyboard
 *   reachable and works with Enter/Space out of the box.
 * - `aria-label` and `aria-pressed` communicate state to assistive tech.
 * - The color pairs in tailwind.config.ts were chosen for at least a
 *   4.5:1 contrast ratio between `textPrimary`/`textSecondary` and their
 *   matching `surface` color in both modes (WCAG 2.1 AA for normal text).
 * - `focus-visible:ring` keeps a visible focus indicator for keyboard
 *   users without adding a persistent ring for mouse users.
 *
 * Transition: `transition-theme duration-300 ease-in-out` (see
 * tailwind.config.ts `transitionProperty.theme`) animates the color swap
 * smoothly instead of snapping instantly, per the task's transition
 * requirement.
 *
 * @param props - See {@link ThemeToggleProps}.
 * @returns The toggle button.
 */
export function ThemeToggle({ locale = 'en' }: ThemeToggleProps): JSX.Element | null {
  const { resolvedPreference, setPreference, isReady } = useTheme();
  const labels = getThemeLabels(locale);

  // Render nothing until the client has read the persisted preference,
  // rather than guessing — prevents a light/dark flash mismatch with SSR.
  if (!isReady || !resolvedPreference) {
    return null;
  }

  const isDark = resolvedPreference === 'dark';

  /** Flips directly between Light and Dark — no third "System" state to cycle through. */
  function handleClick(): void {
    setPreference(isDark ? 'light' : 'dark');
  }

  const currentLabel = isDark ? labels.dark : labels.light;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={labels.toggleAriaLabel}
      aria-pressed={isDark}
      className="
        inline-flex items-center gap-2 rounded-full px-4 py-2
        bg-surfaceMuted-light dark:bg-surfaceMuted-dark
        text-textPrimary-light dark:text-textPrimary-dark
        border border-textSecondary-light/20 dark:border-textSecondary-dark/20
        transition-theme duration-300 ease-in-out
        hover:opacity-90
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light dark:focus-visible:ring-accent-dark
      "
    >
      <ThemeIcon isDark={isDark} />
      <span className="text-sm font-medium">{currentLabel}</span>
    </button>
  );
}

/**
 * Small inline icon reflecting the current theme (sun for light, moon for dark).
 * Kept inline rather than pulling in an icon library, to avoid adding a
 * dependency for two simple glyphs.
 *
 * @param props.isDark - Whether dark mode is currently active.
 * @returns An SVG icon.
 */
function ThemeIcon({ isDark }: { isDark: boolean }): JSX.Element {
  if (!isDark) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
        <path
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
      />
    </svg>
  );
}
