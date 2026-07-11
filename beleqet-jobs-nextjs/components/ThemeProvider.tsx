"use client";

import { ThemeProvider } from "next-themes";

/**
 * Wraps the application with a theme context from `next-themes`.
 *
 * The provider uses the `class` strategy (`.dark` on `<html>`) and defaults
 * to the user's system preference.  Pass this component as high in the tree
 * as possible (typically inside `<html>`) so all children can call
 * `useTheme()`.
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
 * // app/layout.tsx
 * import { Providers } from "@/components/ThemeProvider";
 *
 * export default function RootLayout({ children }) {
 *   return <Providers>{children}</Providers>;
 * }
 * ```
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}