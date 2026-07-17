"use client";

import { ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState, useEffect } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  THEME_OPTIONS,
  resolveThemeLabel,
} from "@/lib/theme/theme-config";

/**
 * A dropdown button that lets the user switch between light, dark and system
 * colour schemes.
 *
 * ## Architecture (SOLID)
 *
 * - **S** – Rendering logic is isolated in this component.
 * - **O** – New theme options can be added by extending `THEME_OPTIONS`
 *   without modifying this file.
 * - **L** – Any `ThemeOption` with the same shape is substitutable.
 * - **I** – Click-outside / Escape behaviour is delegated to the
 *   `useClickOutside` hook.
 * - **D** – Theme values and label resolution depend on abstractions
 *   (`theme-config.ts`) rather than hard-coded strings.
 *
 * ## SSR safety
 *
 * Renders a placeholder `<div>` during SSR/hydration to prevent layout shift.
 * Once mounted it shows the active theme icon and label.
 *
 * ## i18n
 *
 * Labels are resolved via `resolveThemeLabel()`.  To connect your translation
 * library, replace that function at the app level or swap the import.
 *
 * @example
 * ```tsx
 * import ThemeToggle from "@/components/ThemeToggle";
 *
 * export function NavBar() {
 *   return (
 *     <nav>
 *       <ThemeToggle />
 *     </nav>
 *   );
 * }
 * ```
 */
export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useClickOutside(ref, () => setOpen(false));

  /**
   * Button display uses `resolvedTheme` so it always reflects the actual
   * colour scheme in use (system preference by default, or explicit choice).
   * Dropdown highlighting uses `theme` (the user's stored choice) so the
   * correct option stays marked regardless of the system preference.
   */
  const activeValue = resolvedTheme ?? "light";
  const active = THEME_OPTIONS.find((o) => o.value === activeValue) ?? THEME_OPTIONS[0];
  const Icon = active.icon;

  if (!mounted) {
    return (
      <div
        className="h-9 w-9 rounded-xl border border-border bg-surface"
        aria-hidden
      />
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-ink/80 transition-colors hover:border-brandGreen/40 hover:text-ink"
        aria-label={resolveThemeLabel("theme.select")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{resolveThemeLabel(active.labelKey)}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={resolveThemeLabel("theme.select")}
          className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-cardHover"
        >
          {THEME_OPTIONS.map(({ value, labelKey, icon: OptIcon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setTheme(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors ${
                  selected
                    ? "bg-brandGreen/10 font-semibold text-brandGreen"
                    : "text-ink hover:bg-pageBg"
                }`}
              >
                <OptIcon className="h-4 w-4 shrink-0" />
                {resolveThemeLabel(labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
