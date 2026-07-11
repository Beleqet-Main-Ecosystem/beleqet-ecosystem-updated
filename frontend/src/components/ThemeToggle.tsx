"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** A single theme option in the toggle dropdown. */
type ThemeOption = {
  /** Internal value passed to `setTheme()`. */
  value: "light" | "dark" | "system";
  /**
   * Human-readable label.
   *
   * @i18n Replace with a translation key when adding i18n support
   * (e.g., `t("theme.light")`).
   */
  label: string;
  /** Lucide icon component. */
  icon: typeof Sun;
};

const options: readonly ThemeOption[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * A dropdown button that lets the user switch between light, dark and system
 * colour schemes.
 *
 * Renders a placeholder `<div>` during SSR/hydration to prevent layout shift.
 * Once mounted it shows the active theme icon and label, and toggles a
 * listbox on click.  Clicking outside or pressing <kbd>Escape</kbd> closes
 * the menu.
 *
 * ## Architecture (SOLID)
 * - Click-outside / Escape logic is delegated to the browser events via a
 *   dedicated `useEffect` which can be extracted into a reusable hook.
 * - Theme options are declared as a typed constant, making it easy to add or
 *   reorder options without changing the rendering logic.
 *
 * ## i18n
 * The `label` fields in `options` are plain English strings.  When adding
 * internationalisation, replace them with calls to your translation function
 * (e.g., `t("theme.light")`).
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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /**
   * Button display uses `resolvedTheme` so it always reflects the actual
   * colour scheme in use (system preference by default, or explicit choice).
   */
  const activeValue = resolvedTheme ?? "light";
  const active = options.find((o) => o.value === activeValue) ?? options[0];
  const Icon = active.icon;

  if (!mounted) {
    return <div style={{ width: 32, height: 32 }} />;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost btn-sm"
        style={{ padding: "4px 8px", gap: 4 }}
        aria-label="Select theme"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon size={16} />
        <ChevronDown
          size={12}
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme"
          className="modal"
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 8,
            padding: 8,
            minWidth: 150,
            maxWidth: "none",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-card)",
            zIndex: 200,
          }}
        >
          {options.map(({ value, label, icon: OptIcon }) => {
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13,
                  cursor: "pointer",
                  background: selected ? "var(--bg-card)" : "transparent",
                  color: selected
                    ? "var(--accent-blue)"
                    : "var(--text-secondary)",
                  fontWeight: selected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                }}
                onMouseLeave={(e) => {
                  if (!selected)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                <OptIcon size={16} />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
