'use client';

import { useEffect, useState } from 'react';

/**
 * Represents the subset of the Telegram WebApp API used across the app.
 * Full spec: https://core.telegram.org/bots/webapps
 */
export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    start_param?: string;
    auth_date?: number;
    hash?: string;
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  showPopup: (
    params: {
      title?: string;
      message: string;
      buttons?: Array<{
        id?: string;
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
        text?: string;
      }>;
    },
    callback?: (buttonId: string) => void,
  ) => void;
  onEvent: (eventType: string, callback: () => void) => void;
  offEvent: (eventType: string, callback: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface UseTelegramReturn {
  /** The raw WebApp object, or null when running in a regular browser */
  webApp: TelegramWebApp | null;
  /** True when running inside the Telegram WebApp iframe */
  isTMA: boolean;
  /** Telegram user data from initDataUnsafe, or null outside TMA */
  tmaUser: TelegramWebApp['initDataUnsafe']['user'] | null;
}

/**
 * Core hook for Telegram Mini App integration.
 *
 * Returns the `window.Telegram.WebApp` object (typed) plus two convenience
 * flags.  Always returns `isTMA: false` during SSR so server-rendered HTML
 * is identical whether the app runs in Telegram or in a plain browser.
 *
 * @example
 * const { webApp, isTMA } = useTelegram();
 * if (isTMA && webApp) webApp.HapticFeedback.selectionChanged();
 */
export function useTelegram(): UseTelegramReturn {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp ?? null;
    setWebApp(tg);
  }, []);

  return {
    webApp,
    isTMA: webApp !== null,
    tmaUser: webApp?.initDataUnsafe?.user ?? null,
  };
}
