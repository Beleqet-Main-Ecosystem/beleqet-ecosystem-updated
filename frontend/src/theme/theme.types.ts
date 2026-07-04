/**
 * Union of every theme preference the module accepts.
 *
 * - `'light'` / `'dark'` — an explicit manual choice made by the user.
 * - `'system'` — defer to the OS-level `prefers-color-scheme` media query.
 *
 * Keeping this as a literal union (instead of `string`) is what lets
 * TypeScript catch typos like `'Dark'` or `'ligth'` at compile time,
 * which is part of why Rule 4 (no `any`, strict mode) matters here:
 * without it, an invalid value could silently reach `localStorage`.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Runtime-checkable list of the values in {@link ThemePreference}.
 * Used by {@link isValidThemePreference} and by the class-validator DTO
 * to validate values that come from an untyped source (localStorage),
 * since TypeScript types disappear at runtime and cannot protect against
 * a corrupted or tampered stored value.
 */
export const THEME_PREFERENCE_VALUES: readonly ThemePreference[] = [
  'light',
  'dark',
  'system',
];

/**
 * Supported UI locales for the theme toggle's visible labels.
 * Kept intentionally small (English + Amharic) to match the scope of this
 * module — see `i18n/theme.i18n.ts` for the full note on i18n scope.
 */
export type ThemeLocale = 'en' | 'am';
