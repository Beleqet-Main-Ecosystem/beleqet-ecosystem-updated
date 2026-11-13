'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useTelegram } from '@/hooks/useTelegram';
import { useTranslation, type SupportedLocale } from '@/lib/i18n';
import { apiGet } from '@/features/dashboard/api';

/** The home page's greens, which the Mini App wears inside Telegram. */
export const MINI_COLORS = {
  deep: '#073B25',
  lime: '#7ED957',
  onLime: '#123014',
  bgLight: '#F5F8F5',
  bgDark: '#06130A',
} as const;

/**
 * Inside Telegram: colours Telegram's own header and bottom button in the Beleqet greens, matches
 * Telegram's light or dark theme, and keeps up when the person switches theme in Telegram.
 */
export function useMiniAppChrome(): void {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (!webApp) return;
    const apply = () => {
      const dark = webApp.colorScheme === 'dark';
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      try {
        webApp.setHeaderColor?.(MINI_COLORS.deep);
        webApp.setBackgroundColor?.(dark ? MINI_COLORS.bgDark : MINI_COLORS.bgLight);
        webApp.setBottomBarColor?.(dark ? MINI_COLORS.bgDark : '#FFFFFF');
        webApp.MainButton.setParams?.({ color: MINI_COLORS.lime, text_color: MINI_COLORS.onLime });
      } catch {
        // Older Telegram clients lack some of these; the defaults are fine there.
      }
    };
    apply();
    webApp.onEvent('themeChanged', apply);
    return () => webApp.offEvent('themeChanged', apply);
  }, [webApp]);
}

/**
 * The language chosen in the bot (saved on the account) wins; before sign-in, Telegram's own
 * language setting. The website's language picker isn't shown in the Mini App.
 */
export function useAccountLanguage(): void {
  const { user, ready } = useAuth();
  const { tmaUser } = useTelegram();
  const { locale, setLocale } = useTranslation();

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const choose = (language: string | undefined) => {
      const wanted: SupportedLocale = language === 'am' ? 'am' : 'en';
      if (active && wanted !== locale) setLocale(wanted);
    };
    if (user) {
      apiGet<{ language?: string } | null>('/users/notification-preferences')
        .then((prefs) => choose(prefs?.language))
        .catch(() => undefined);
    } else if (tmaUser) {
      choose((tmaUser as { language_code?: string }).language_code);
    }
    return () => {
      active = false;
    };
    // The locale is an output here: re-running when it changes would undo a deliberate switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id, tmaUser?.id]);
}
