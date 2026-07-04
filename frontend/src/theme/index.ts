/**
 * Public entry point for the Dark/Light Mode module.
 * Everything the rest of the app needs is re-exported from here, so
 * consumers never import from the module's internal files directly —
 * the same "depend on the module's public surface, not its internals"
 * discipline Rule 1 asks for on the backend.
 */
export { ThemeProvider } from './ThemeProvider';
export type { ThemeProviderProps } from './ThemeProvider';

export { useTheme } from './useTheme';
export type { UseThemeResult } from './useTheme';

export { ThemeToggle } from './ThemeToggle';
export type { ThemeToggleProps } from './ThemeToggle';

export { isValidThemePreference } from './theme-preference.dto';
export type { ThemePreference, ThemeLocale } from './theme.types';
