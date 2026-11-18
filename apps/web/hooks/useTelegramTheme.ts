'use client';

import { useEffect } from 'react';
import { useTelegram } from './useTelegram';

/**
 * Injects Telegram theme colours into the document's CSS custom properties
 * and adds the `in-telegram` class to `document.body`.
 *
 * Must be called once near the root of the app (e.g. inside RootLayout).
 * Subscribes to the `themeChanged` event so live theme switches inside
 * Telegram (dark ↔ light) are reflected immediately without a page reload.
 *
 * Has no effect when running in a regular browser.
 *
 * @example
 * // app/layout.tsx
 * export default function RootLayout({ children }) {
 *   useTelegramTheme();
 *   return <html>...</html>;
 * }
 */
export function useTelegramTheme(): void {
  const { webApp, isTMA } = useTelegram();

  useEffect(() => {
    if (!isTMA || !webApp) return;

    document.body.classList.add('in-telegram');

    const applyTheme = () => {
      const p = webApp.themeParams;
      const root = document.documentElement;

      if (p.bg_color) root.style.setProperty('--tg-theme-bg-color', p.bg_color);
      if (p.text_color) root.style.setProperty('--tg-theme-text-color', p.text_color);
      if (p.hint_color) root.style.setProperty('--tg-theme-hint-color', p.hint_color);
      if (p.link_color) root.style.setProperty('--tg-theme-link-color', p.link_color);
      if (p.button_color) root.style.setProperty('--tg-theme-button-color', p.button_color);
      if (p.button_text_color)
        root.style.setProperty('--tg-theme-button-text-color', p.button_text_color);
      if (p.secondary_bg_color)
        root.style.setProperty('--tg-theme-secondary-bg-color', p.secondary_bg_color);
    };

    applyTheme();
    webApp.onEvent('themeChanged', applyTheme);

    return () => {
      webApp.offEvent('themeChanged', applyTheme);
      document.body.classList.remove('in-telegram');
    };
  }, [isTMA, webApp]);
}
