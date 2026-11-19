import type { Metadata } from 'next';

// Opened by the Android app's sign-in; nothing here for search engines.
export const metadata: Metadata = {
  title: 'Sign in with Telegram · Beleqet',
  robots: { index: false, follow: false },
};

export default function TelegramAppLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
