import type { Metadata } from 'next';
import MiniAppShell from '@/features/miniapp/MiniAppShell';

// The Mini App opens from the Beleqet Jobs bot; its pages aren't for search engines.
export const metadata: Metadata = {
  title: 'Beleqet Jobs',
  robots: { index: false, follow: false },
};

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return <MiniAppShell>{children}</MiniAppShell>;
}
