import React, { ReactNode } from 'react';
import { ThemeProvider } from '../src/theme';
import './globals.css';

export const metadata = {
  title: 'Beleqet — Dark/Light Mode Demo',
  description: 'Minimal host app demonstrating the Dark/Light Mode module.',
};

/**
 * Root layout for the demo app.
 *
 * `suppressHydrationWarning` on <html> is the standard, documented
 * `next-themes` pairing: the theme class is applied on the client right
 * before paint (to avoid a flash), which legitimately differs from the
 * server-rendered markup for one frame — this suppresses the resulting
 * (expected, harmless) hydration warning without suppressing real ones,
 * since it's scoped to just the <html> element.
 *
 * @param props.children - Page content.
 * @returns The document shell wrapped in {@link ThemeProvider}.
 */
export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
