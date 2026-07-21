import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import QueryProvider from "@/components/QueryProvider";
import ChatWidget from "@/components/ChatWidget";
import { Toaster } from "sonner";
import { WebSiteSchema } from "@/lib/seo/schemas";
import { getSeoConfig } from "@/lib/seo/config";
import { homePageMetadata } from "@/lib/seo/generate-metadata";

export const metadata: Metadata = homePageMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { themeColor, defaultLocale } = getSeoConfig();

  return (
    <html lang={defaultLocale}>
      <head>
        <meta name="theme-color" content={themeColor} />
        <meta name="color-scheme" content="light" />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <QueryProvider>
            <WebSiteSchema />
            <Header />
            <main>
              {' '}
              {children}
              <Toaster position="top-right" richColors />
            </main>
            <Footer />
            <ChatWidget />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
