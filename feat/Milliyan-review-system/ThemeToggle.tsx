'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/**
 * Persistent light/dark mode toggle for the Beleqet frontend.
 *
 * Persistence: `next-themes` stores the chosen theme in `localStorage`
 * (key: "theme") and applies it as a class on `<html>`, which pairs
 * with Tailwind's `darkMode: 'class'` strategy in `tailwind.config.js`.
 * This avoids a flash-of-wrong-theme on reload and keeps the
 * preference client-side only (no PII, so no GDPR consent needed for
 * this particular value).
 *
 * Requires the app to be wrapped once in a `ThemeProvider`
 * (from `next-themes`) at the root layout:
 *
 * ```tsx
 * // app/layout.tsx
 * import { ThemeProvider } from 'next-themes';
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html lang="en" suppressHydrationWarning>
 *       <body>
 *         <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 *           {children}
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export default function ThemeToggle(): JSX.Element {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Avoids a hydration mismatch: theme is only known client-side.
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Reserve the same footprint to avoid layout shift while mounting.
    return <div className="h-9 w-9" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === 'dark';

  /** Toggles between light and dark, persisted automatically by next-themes. */
  const handleToggle = (): void => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={`
        relative inline-flex h-9 w-9 items-center justify-center rounded-full
        border border-gray-300 bg-white text-gray-700
        transition-colors duration-300 ease-in-out
        hover:bg-gray-100
        dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400
      `}
    >
      <span className="transition-transform duration-300 ease-in-out">
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
    </button>
  );
}
