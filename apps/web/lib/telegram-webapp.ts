import type { TelegramWebApp } from '@/hooks/useTelegram';

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js';

let loading: Promise<TelegramWebApp | null> | null = null;

/**
 * True when the page was opened as a Telegram Mini App. Telegram puts the signed launch data in
 * the URL hash, and its script keeps it in sessionStorage for reloads inside the Mini App.
 */
export function isTelegramLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.hash.includes('tgWebAppData')) return true;
  try {
    return Boolean(sessionStorage.getItem('__telegram__initParams'));
  } catch {
    return false;
  }
}

/**
 * Telegram's WebApp object, or null in a normal browser. The script is only loaded for Mini App
 * launches, so ordinary visitors don't download it.
 */
export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (typeof window === 'undefined' || !isTelegramLaunch()) return Promise.resolve(null);
  if (!loading) {
    loading = new Promise((resolve) => {
      const done = () => {
        const webApp = window.Telegram?.WebApp ?? null;
        // Outside Telegram the script still creates the object, with empty launch data.
        resolve(webApp?.initData ? webApp : null);
      };
      if (window.Telegram?.WebApp) return done();
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = done;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }
  return loading;
}
