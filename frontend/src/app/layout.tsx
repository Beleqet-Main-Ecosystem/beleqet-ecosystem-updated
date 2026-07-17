import type { Metadata } from 'next';
import '@/styles/globals.css';
import { FaqBotWidget } from '@/components/FaqBot/FaqBotWidget';

export const metadata: Metadata = {
  title: 'Beleqet Admin — Dashboard',
  description: 'Admin control panel for the Beleqet Global Freelance Ecosystem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FaqBotWidget />
      </body>
    </html>
  );
}
