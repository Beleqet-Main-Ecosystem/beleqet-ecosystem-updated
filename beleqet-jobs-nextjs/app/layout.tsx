import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import ChatWidget from "@/components/ChatWidget";
import { WebSiteSchema } from "@/lib/seo/schemas";
import { getSeoConfig } from "@/lib/seo/config";
import { homePageMetadata } from "@/lib/seo/generate-metadata";
import { Providers } from "@/components/ThemeProvider";

export const metadata: Metadata = homePageMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { defaultLocale } = getSeoConfig();

  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <body className="font-sans antialiased">
      <Providers>
        <AuthProvider>
          <WebSiteSchema />
          <Header />
          <main>{children}</main>
          <Footer />
          <ChatWidget />
        </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
