"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Application-wide theme provider using `next-themes`.
 *
 * Uses the `class` strategy (toggles `.dark` on `<html>`), respects the
 * user's system preference by default, and disables the transition flash
 * that can occur on initial load.
 *
 * ## Privacy / GDPR
 *
 * `next-themes` stores the user's theme preference under the key
 * `theme` in **localStorage**.  No personal data is collected, transmitted,
 * or shared with third parties.  The stored value is one of:
 * `"light"`, `"dark"`, or `"system"` and is used **solely** to persist the
 * user's visual preference across sessions.
 *
 * If your application requires explicit consent before writing to
 * localStorage, defer rendering this provider until consent is granted,
 * or clear `localStorage.removeItem("theme")` when consent is withdrawn.
 *
 * @example
 * ```tsx
 * // src/App.tsx
 * import { ThemeProvider } from "@/components/ThemeProvider";
 *
 * export default function App() {
 *   return <ThemeProvider><YourRoutes /></ThemeProvider>;
 * }
 * ```
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
