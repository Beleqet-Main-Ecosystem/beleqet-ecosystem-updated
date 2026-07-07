import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import ChatWidget from "@/components/ChatWidget";

// Using Inter via next/font/google requires network access to Google Fonts at
// build time. If your deployment environment can reach fonts.googleapis.com,
// swap this back to:
//   import { Inter } from "next/font/google";
//   const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400","500","600","700","800"] });
// and add inter.variable to the <html> className below.

export const metadata: Metadata = {
  title: "Beleqet Jobs | Find Your Next Opportunity Faster",
  description:
    "Search verified jobs from trusted employers across Ethiopia. Discover thousands of job opportunities, get instant alerts on Telegram, and apply faster with Beleqet Vacancy Platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
