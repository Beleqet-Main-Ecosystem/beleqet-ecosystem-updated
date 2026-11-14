'use client';

import { useAccountLanguage, useMiniAppChrome } from './chrome';

/**
 * The Telegram Mini App: its own screens in the home page's greens, filling Telegram's window,
 * with none of the website's header, footer or menus (see WebsiteOnly).
 */
export default function MiniAppShell({ children }: { children: React.ReactNode }) {
  useMiniAppChrome();
  useAccountLanguage();
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-mini-bg text-ink-900 dark:bg-mini-dbg dark:text-mini-dtext">
      <div className="mx-auto flex min-h-full max-w-xl flex-col">{children}</div>
    </div>
  );
}
