import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';
import QueryProvider from '@/components/QueryProvider';
import ChatWidget from '@/components/ChatWidget';
import { WebSiteSchema } from '@/lib/seo/schemas';
import { getSeoConfig } from '@/lib/seo/config';
import { homePageMetadata } from '@/lib/seo/generate-metadata';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TelegramInitializer } from '@/components/TelegramInitializer';

export const metadata: Metadata = homePageMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { themeColor, defaultLocale } = getSeoConfig();

  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={themeColor} />
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-screen bg-pageBg font-sans text-ink antialiased transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>
          <AuthProvider>
            <QueryProvider>
              {/*
               * TelegramInitializer runs once on mount:
               * - calls webApp.ready() and webApp.expand()
               * - injects Telegram theme colours into CSS custom properties
               * - adds body.in-telegram class for TMA-specific CSS
               * No-op when running in a regular browser.
               */}
              <TelegramInitializer />
              <WebSiteSchema />
              <Header />
              <main>
                {children}
                <Toaster position="top-right" richColors />
              </main>
              <Footer />
              <ChatWidget />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
