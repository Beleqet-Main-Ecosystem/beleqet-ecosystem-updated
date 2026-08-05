'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from './useTelegram';

/**
 * Maps a `start_param` prefix to the corresponding Next.js route.
 * Add new deep-link targets here as the app grows.
 *
 * Backend push notifications and inline keyboard buttons set these
 * params when launching the Mini App — e.g. `gig_123`, `contract_45`.
 */
const DEEP_LINK_ROUTES: Record<string, (id: string) => string> = {
  gig_: (id) => `/jobs/${id}`,
  contract_: (id) => `/escrow/contracts/${id}`,
  proposal_: (id) => `/freelance/proposals/${id}`,
  ref_: (id) => `/invite?ref=${id}`,
};

/**
 * Intercepts Telegram deep-link `start_param` on app boot and redirects
 * to the appropriate page.
 *
 * The param is read from two sources (in priority order):
 *  1. `window.Telegram.WebApp.initDataUnsafe.start_param`
 *  2. `?start_param=` in the URL query string (fallback for web browsers)
 *
 * Call this hook once inside the root layout or a top-level component.
 * Has no side effects after the first mount — the redirect fires at most once.
 *
 * @example
 * // Telegram sends user to the app with start_param = "gig_99"
 * // → useTelegramDeepLink() redirects to /jobs/99
 */
export function useTelegramDeepLink(): void {
  const { webApp } = useTelegram();
  const router = useRouter();

  useEffect(() => {
    const startParam =
      webApp?.initDataUnsafe?.start_param ??
      new URLSearchParams(window.location.search).get('start_param');

    if (!startParam) return;

    for (const [prefix, buildRoute] of Object.entries(DEEP_LINK_ROUTES)) {
      if (startParam.startsWith(prefix)) {
        const id = startParam.slice(prefix.length);
        if (id) {
          router.push(buildRoute(id));
          return;
        }
      }
    }

    // Unknown param — log for debugging but don't crash
    console.warn('[TMA] Unhandled deep-link start_param:', startParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount only
}
