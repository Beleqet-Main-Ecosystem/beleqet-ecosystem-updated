"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Icon button that toggles the application theme between light and dark mode.
 *
 * - Displays a **Moon** icon in light mode, a **Sun** icon in dark mode.
 * - Uses `next-themes` `useTheme` hook to read and set the active theme.
 * - Theme preference is stored in `localStorage` (key: `beleqet-theme`).
 * - Renders an invisible placeholder before hydration to avoid layout shift.
 * - Smooth transition is applied via the global CSS in `globals.css`.
 *
 * @example
 * <ThemeToggle />
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // Defer render until client mount to prevent SSR/hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    // Invisible placeholder — matches button dimensions to prevent layout shift
    return <span className="inline-flex h-9 w-9" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-xl",
        "border border-primary/10 text-primary",
        "transition-all duration-200 ease-in-out",
        "hover:bg-primary/5 active:scale-90",
        "dark:border-[var(--color-border)] dark:text-[var(--color-text)] dark:hover:bg-white/10",
      ].join(" ")}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-300 hover:rotate-12" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 hover:-rotate-12" aria-hidden="true" />
      )}
    </button>
  );
}
