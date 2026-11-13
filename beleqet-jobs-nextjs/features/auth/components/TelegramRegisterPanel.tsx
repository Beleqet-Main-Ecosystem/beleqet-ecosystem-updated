'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { isTelegramLaunch } from '@/lib/telegram-webapp';
import { botRegistrationUrl, openInTelegram } from '@/lib/telegram-login';
import { safeNextPath } from '../redirect';
import { focusRing } from './fields';

/**
 * Accounts are made in the Beleqet Jobs bot, which asks for the phone, gender, residence and job
 * title. Shown inside Telegram (where there's no account to sign in to yet) and after "Sign in
 * with Telegram" finds no account. A job the person wanted opens again once they've registered.
 */
export default function TelegramRegisterPanel({ always = false }: { always?: boolean }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(always);

  useEffect(() => {
    if (!always) setShow(isTelegramLaunch());
  }, [always]);

  if (!show) return null;

  function open() {
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    openInTelegram(botRegistrationUrl(next));
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-[#B9D88A] bg-[#F1F7EC] p-4 dark:border-limeAccent/40 dark:bg-slate-900" aria-labelledby="tg-register-title">
      <b id="tg-register-title" className="text-[15px] text-ink-900 dark:text-white">{t('auth.telegramRegister.title')}</b>
      <p className="text-sm leading-relaxed text-ink-700 dark:text-slate-300">{t('auth.telegramRegister.text')}</p>
      <button type="button" onClick={open} className={`inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-[#229ED9] px-4 text-sm font-bold text-white ${focusRing}`}>
        {t('auth.telegramRegister.button')}
      </button>
    </section>
  );
}
