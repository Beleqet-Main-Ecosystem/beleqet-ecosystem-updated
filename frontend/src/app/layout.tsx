import type { Metadata } from 'next';
import '@/styles/globals.css';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'Beleqet Admin — Dashboard',
  description: 'Admin control panel for the Beleqet Global Freelance Ecosystem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark"]}
        >
          {children}
        </NextThemesProvider>
      </body>
    </html>
  );
}