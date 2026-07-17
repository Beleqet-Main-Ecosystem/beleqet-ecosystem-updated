import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";

/**
 * A single theme option in the toggle dropdown.
 *
 * @typeParam T - The concrete theme value type (defaults to built-in values).
 */
export interface ThemeOption<T extends string = "light" | "dark" | "system"> {
  /** Internal value passed to `setTheme()`. */
  value: T;
  /**
   * Human-readable label key.
   *
   * @i18n Translate these keys in your i18n system (e.g., `t("theme.light")`).
   *       Labels default to English for development convenience.
   */
  labelKey: string;
  /** Lucide icon component. */
  icon: LucideIcon;
}

/**
 * Default theme options with i18n-ready label keys.
 *
 * The `labelKey` fields are designed to be passed through a translation
 * function (`t()`).  When no i18n system is available the raw key is shown,
 * which doubles as a sensible English default.
 *
 * @example i18n usage
 * ```json
 * // translations/en.json
 * { "theme": { "light": "Light", "dark": "Dark", "system": "System" } }
 * ```
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  { value: "light", labelKey: "theme.light", icon: Sun },
  { value: "dark", labelKey: "theme.dark", icon: Moon },
  { value: "system", labelKey: "theme.system", icon: Monitor },
] as const;

/**
 * Maps a label key to a display string.
 *
 * **i18n integration point** — replace this function at the app level to
 * connect your translation library.  By default it returns the last segment
 * of the key as a simple English string.
 *
 * @example
 * ```ts
 * // With react-i18next / next-i18next:
 * import { useTranslation } from "react-i18next";
 * const { t } = useTranslation();
 * const display = t(option.labelKey);
 * ```
 */
export function resolveThemeLabel(labelKey: string): string {
  const map: Record<string, string> = {
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.system": "System",
    "theme.select": "Select theme",
  };
  return map[labelKey] ?? labelKey.split(".").pop() ?? labelKey;
}
