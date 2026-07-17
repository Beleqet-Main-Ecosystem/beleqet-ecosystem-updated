/**
 * @module app/layout
 * @description Root layout for the Beleqet Jobs application.
 *
 * Wraps all pages with:
 * - {@link I18nProvider} — locale-aware translations (EN / AM).
 * - {@link AuthProvider} — JWT authentication context.
 * - {@link Header} — sticky responsive header with hamburger menu.
 * - {@link Footer} — full-width footer (hidden on dashboard pages via CSS).
 * - {@link MobileBottomNav} — fixed bottom tab bar, mobile only.
 * - {@link GdprConsentBanner} — GDPR cookie consent, mobile optimised.
 * - {@link ChatWidget} — floating AI chat (lazy loaded).
 */

import { lazy, Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { I18nProvider } from "@/lib/i18n";

/* Lazy-loaded modules that are not critical for first paint. */
const MobileBottomNav = lazy(
  () => import("@/components/mobile/MobileBottomNav"),
);
const GdprConsentBanner = lazy(
  () => import("@/components/mobile/GdprConsentBanner"),
);
const ChatWidget = lazy(() => import("@/components/ChatWidget"));

/** @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata */
export const metadata: Metadata = {
  title: "Beleqet Jobs | Find Your Next Opportunity Faster",
  description:
    "Search verified jobs from trusted employers across Ethiopia. Discover thousands of job opportunities, get instant alerts on Telegram, and apply faster with Beleqet Vacancy Platform.",
};

/**
 * Root layout component rendered around every page.
 *
 * Structure:
 * ```
 * <html>
 *   <body>
 *     <I18nProvider>
 *       <AuthProvider>
 *         <Header />
 *         <main>{children}</main>
 *         <Footer />
 *         <MobileBottomNav />    ← mobile only
 *         <GdprConsentBanner />  ← lazy, mobile optimised
 *         <ChatWidget />         ← lazy
 *       </AuthProvider>
 *     </I18nProvider>
 *   </body>
 * </html>
 * ```
 *
 * @param props.children - The page component tree.
 * @returns The complete HTML document shell.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <I18nProvider>
          <AuthProvider>
            <Header />
            <main>
            {' '}
            {children}
            <Toaster position="top-right" richColors />
          </main>
            <Footer />
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
            <Suspense fallback={null}>
              <GdprConsentBanner />
            </Suspense>
            <Suspense fallback={null}>
              <ChatWidget />
            </Suspense>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}