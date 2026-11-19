'use client';

import { usePathname } from 'next/navigation';
import { isMiniAppPath } from '@/lib/mini-app';

/** The website's own chrome, left out of the Telegram Mini App, which has its own. */
export default function WebsiteOnly({ children }: { children: React.ReactNode }) {
  return isMiniAppPath(usePathname()) ? null : <>{children}</>;
}
