import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.css';
import { FaqBotWidget } from '@/components/FaqBot/FaqBotWidget';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ThemeScript } from '@/components/theme/theme-script';

export const metadata: Metadata = {
  title: 'Beleqet Admin — Dashboard',
  description: 'Admin control panel for the Beleqet Global Freelance Ecosystem',
};

/** Root document layout with pre-hydration theme application. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <FaqBotWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}