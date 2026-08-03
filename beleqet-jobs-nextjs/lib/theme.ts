"use client";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

export const THEME_STORAGE_KEY = "beleqet-theme";

/**
 * Reads the stored theme preference from browser storage.
 */
export function getStoredThemePreference(
  value?: string | null,
): ThemePreference {
  if (value === "light" || value === "dark") {
    return value;
  }

  return "system";
}

/**
 * Resolves the active theme based on the chosen preference or the system setting.
 */
export function getResolvedTheme(preference: ThemePreference): ThemeMode {
  if (preference === "dark" || preference === "light") {
    return preference;
  }

  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

/**
 * Persists the chosen preference and updates the document theme classes.
 */
export function applyThemePreference(preference: ThemePreference): ThemeMode {
  const resolvedTheme = getResolvedTheme(preference);

  if (typeof window !== "undefined") {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  }

  return resolvedTheme;
}
