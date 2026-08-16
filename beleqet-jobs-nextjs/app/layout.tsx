import { lazy, Suspense } from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/components/AuthProvider';
import QueryProvider from '@/components/QueryProvider';
import { WebSiteSchema } from '@/lib/seo/schemas';
import { getSeoConfig } from '@/lib/seo/config';
import { homePageMetadata } from '@/lib/seo/generate-metadata';
import { ThemeProvider } from '@/components/ThemeProvider';
import { I18nProvider } from '@/lib/i18n';
import { TelegramInitializer } from '@/components/TelegramInitializer';

/* Lazy-load non-critical modules — not needed on first paint */
const ChatWidget = lazy(() => import('@/components/ChatWidget'));
const MobileBottomNav = lazy(() => import('@/components/mobile/MobileBottomNav'));
const GdprConsentBanner = lazy(() => import('@/components/mobile/GdprConsentBanner'));

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
        <I18nProvider>
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
              <Suspense fallback={null}><ChatWidget /></Suspense>
              {/* Mobile-only: fixed bottom tab bar */}
              <Suspense fallback={null}><MobileBottomNav /></Suspense>
              {/* GDPR consent banner — lazy, mobile-optimised */}
              <Suspense fallback={null}><GdprConsentBanner /></Suspense>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}