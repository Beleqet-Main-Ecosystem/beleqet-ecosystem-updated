"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

/**
 * Application-level theme provider.
 *
 * Wraps `next-themes` ThemeProvider with project defaults.
 * Place this in `layout.tsx` to enable dark/light mode across the app.
 *
 * Strategy: `attribute="class"` — next-themes adds `class="dark"` to `<html>`,
 * which Tailwind's `darkMode: "class"` config picks up automatically.
 *
 * Defaults:
 * - `defaultTheme="system"` — follows OS preference on first visit.
 * - `enableSystem=true` — auto-detects OS dark/light setting.
 * - `storageKey="beleqet-theme"` — persists choice in `localStorage`.
 *
 * @param children - React subtree to wrap with theme context.
 * @param props - Any additional `next-themes` props to override defaults.
 *
 * @example
 * <ThemeProvider>
 *   {children}
 * </ThemeProvider>
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="beleqet-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
