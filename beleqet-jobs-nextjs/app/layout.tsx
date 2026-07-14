import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import CookieBanner from "@/components/CookieBanner";
import ChatWidget from "@/components/ChatWidget";
import { WebSiteSchema } from "@/lib/seo/schemas";
import { homePageMetadata } from "@/lib/seo/generate-metadata";

export const metadata: Metadata = homePageMetadata();

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // next-intl resolves the locale via middleware + i18n/request.ts
  const locale = await getLocale();
  // Load the message bundle for the current locale (passed to the client provider)
  const messages = await getMessages();

  return (
    /*
     * `suppressHydrationWarning` is required because next-themes injects
     * a `class` attribute on <html> on the client to apply the stored theme.
     */
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body className="font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text)]">
        {/*
         * NextIntlClientProvider makes the message catalogue and locale
         * available to all `useTranslations` / `useLocale` client hooks.
         */}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <CurrencyProvider>
              <AuthProvider>
                <WebSiteSchema />
                <Header />
                <main>{children}</main>
                <Footer />
                <ChatWidget />
                <CookieBanner />
              </AuthProvider>
            </CurrencyProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
