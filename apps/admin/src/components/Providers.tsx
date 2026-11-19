'use client';

import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from './AuthProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
