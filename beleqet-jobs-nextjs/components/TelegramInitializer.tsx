'use client';

import { useEffect } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useTelegramTheme } from '@/hooks/useTelegramTheme';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useTelegramDeepLink } from '@/hooks/useTelegramDeepLink';

/**
 * Single component that bootstraps the full Telegram Mini App integration.
 * Drop it once inside the root layout — it renders nothing to the DOM.
 *
 * On mount (inside Telegram only) it:
 *  1. Calls `webApp.ready()` — dismisses Telegram's loading spinner
 *  2. Calls `webApp.expand()` — pulls the WebApp to full-screen height
 *  3. Enables the closing confirmation dialog (prevents accidental exit
 *     during active bidding / escrow flows)
 *  4. Injects Telegram theme palette into CSS custom properties and adds
 *     `body.in-telegram` for TMA-specific styles
 *  5. Wires the native BackButton to `router.back()` on non-root routes
 *  6. Intercepts `start_param` deep links and redirects to the correct page
 *
 * All hooks are no-ops when running in a regular browser.
 */
export function TelegramInitializer() {
  const { webApp, isTMA } = useTelegram();

  // Theme injection + body.in-telegram class
  useTelegramTheme();

  // Native back button wired to Next.js router
  useTelegramBackButton();

  // Deep-link start_param → route redirect (runs once on mount)
  useTelegramDeepLink();

  useEffect(() => {
    if (!isTMA || !webApp) return;

    // 1. Signal to Telegram that the app UI is ready — hides loading spinner
    webApp.ready();

    // 2. Expand to full viewport height immediately.
    //    Telegram defaults to half-screen on iOS/Android — expand() is REQUIRED.
    webApp.expand();

    // 3. Ask Telegram to show a confirmation dialog when the user tries to
    //    close the app — prevents accidental exit mid-flow.
    webApp.enableClosingConfirmation();
  }, [isTMA, webApp]);

  return null;
}
