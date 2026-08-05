'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTelegram } from './useTelegram';

/** Routes considered "home" — BackButton is hidden on these. */
const ROOT_PATHS = new Set(['/', '/home', '/jobs', '/feed']);

/**
 * Wires Telegram's native top-left BackButton to the Next.js router.
 *
 * - Shows the BackButton on any route that is not a root/home path
 * - Hides it on root paths so users are never trapped with a back button
 *   that leads nowhere
 * - Calls `router.back()` when the user taps the native button
 *
 * Drop this hook once inside a layout-level component (e.g. TelegramInitializer).
 * Has no effect in a regular browser (isTMA === false).
 *
 * @example
 * // components/TelegramInitializer.tsx
 * useTelegramBackButton();
 */
export function useTelegramBackButton(): void {
  const { webApp, isTMA } = useTelegram();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isTMA || !webApp) return;

    const backBtn = webApp.BackButton;
    const isRoot = ROOT_PATHS.has(pathname);
    const handleBack = () => router.back();

    if (isRoot) {
      backBtn.hide();
    } else {
      backBtn.show();
      backBtn.onClick(handleBack);
    }

    return () => {
      backBtn.offClick(handleBack);
      backBtn.hide();
    };
  }, [isTMA, webApp, pathname, router]);
}
