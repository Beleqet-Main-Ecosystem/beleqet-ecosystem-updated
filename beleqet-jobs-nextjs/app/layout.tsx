import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import ChatWidget from "@/components/ChatWidget";
import { WebSiteSchema } from "@/lib/seo/schemas";
import { getSeoConfig } from "@/lib/seo/config";
import { homePageMetadata } from "@/lib/seo/generate-metadata";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = homePageMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
            <WebSiteSchema />
            <Header />
            <main>{children}</main>
            <Footer />
            <ChatWidget />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
