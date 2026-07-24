/** User-selectable persistence values shared with the User Preferences API. */
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

/** DOM class applied for a resolved dark colour scheme. */
export const DARK_THEME_CLASS = 'dark';

/** Browser storage key intentionally scoped to this product. */
export const THEME_STORAGE_KEY = 'beleqet.theme';

/** Cookie mirrored from local storage so the first server response can be themed consistently. */
export const THEME_COOKIE_KEY = 'beleqet_theme';

/**
 * Returns true when the chosen preference resolves to dark for the current OS.
 *
 * @param preference - user-selected display preference
 * @param systemPrefersDark - current operating-system preference
 * @returns whether the root element should receive the dark class
 */
export function resolvesToDark(preference: ThemePreference, systemPrefersDark: boolean): boolean {
  return preference === 'DARK' || (preference === 'SYSTEM' && systemPrefersDark);
}

/**
 * Narrows untrusted storage or network values to a valid persisted preference.
 *
 * @param value - value read from a browser cache or API response
 * @returns a valid preference, or null when the value must be ignored
 */
export function parseThemePreference(value: unknown): ThemePreference | null {
  return value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM' ? value : null;
}
