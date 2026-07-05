import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Beleqet FAQ Bot Demo',
  description: 'AI-powered FAQ Bot for the Beleqet freelance ecosystem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
