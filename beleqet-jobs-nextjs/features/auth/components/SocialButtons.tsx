'use client';

import { useEffect, useState } from 'react';
import TelegramRegisterPanel from './TelegramRegisterPanel';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { oauthStartUrl, OAUTH_NEXT_KEY, OAUTH_TWO_FACTOR_KEY, signInWithTelegramLogin } from '@/lib/auth';
import { askTelegram, prepareTelegramLogin } from '@/lib/telegram-login';
import { useTranslation } from '@/lib/i18n';
import { homeFor, safeNextPath } from '../redirect';
import { focusRing } from './fields';

const button = `inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-ink-300 bg-surface px-1 text-sm font-semibold sm:text-[15px] text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`;

/** Google, LinkedIn and Telegram sign-in, with the "or with email" divider the design puts under them. */
export default function SocialButtons() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { setUser } = useAuth();
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramError, setTelegramError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);

  // Telegram's script is small; loading it now lets its popup open straight from the click.
  useEffect(() => prepareTelegramLogin(), []);

  async function signInWithTelegram() {
    setTelegramError('');
    setNotRegistered(false);
    setTelegramBusy(true);
    try {
      const { data, failed } = await askTelegram(locale);
      if (!data) {
        if (failed) setTelegramError(t('auth.telegramFailed'));
        return;
      }
      const result = await signInWithTelegramLogin(data);
      if (result.status === 'not-registered') {
        setNotRegistered(true);
        return;
      }
      if (result.status === 'needs-code') {
        // The sign-in page asks for the two-step code, as after Google.
        remember();
        sessionStorage.setItem(OAUTH_TWO_FACTOR_KEY, result.tempToken);
        window.location.assign(`/login${window.location.search}`);
        return;
      }
      if (result.status === 'signed-in') {
        setUser(result.user);
        router.replace(safeNextPath(new URLSearchParams(window.location.search).get('next')) ?? homeFor(result.user));
      }
    } catch (problem) {
      setTelegramError(problem instanceof Error ? problem.message : t('auth.telegramFailed'));
    } finally {
      setTelegramBusy(false);
    }
  }

  function remember() {
    try {
      const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
      if (next) sessionStorage.setItem(OAUTH_NEXT_KEY, next);
      else sessionStorage.removeItem(OAUTH_NEXT_KEY);
    } catch {
      // Storage blocked: they land on their dashboard instead.
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <a href={oauthStartUrl('google')} onClick={remember} className={button}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.5 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.2C1.4 8.5 1 10.2 1 12s.4 3.5 1.2 5l3.6-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 4 3.5 2.2 7l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
          Google
        </a>
        <a href={oauthStartUrl('linkedin')} onClick={remember} className={button}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2" /><path fill="#FFFFFF" d="M7 9.5h2.5V18H7zM8.2 5.5a1.4 1.4 0 1 1 0 2.9 1.4 1.4 0 0 1 0-2.9zM11 9.5h2.4v1.2c.4-.7 1.2-1.4 2.6-1.4 2.6 0 3 1.7 3 3.9V18h-2.5v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2V18H11z" /></svg>
          LinkedIn
        </a>
        <button type="button" onClick={signInWithTelegram} disabled={telegramBusy} aria-busy={telegramBusy} className={`${button} disabled:opacity-60`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#229ED9" /><path fill="#FFFFFF" d="M5.4 11.7l11.6-4.5c.5-.2 1 .1.8.9l-2 9.3c-.1.6-.5.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5c.2-.2 0-.3-.4-.1l-6.9 4.3-3-.9c-.6-.2-.7-.7.2-.9z" /></svg>
          Telegram
        </button>
      </div>
      {telegramError && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{telegramError}</p>}
      {notRegistered && (
        <div role="status" className="flex flex-col gap-2">
          <TelegramRegisterPanel always />
          <p className="text-sm text-ink-700 dark:text-slate-300">{t('auth.telegramRegister.haveAccount')}</p>
        </div>
      )}
      <div aria-hidden="true" className="flex items-center gap-3 text-[13px] text-ink-500 dark:text-slate-400">
        <span className="h-px flex-1 bg-ink-200 dark:bg-slate-800" />
        {t('auth.orEmail')}
        <span className="h-px flex-1 bg-ink-200 dark:bg-slate-800" />
      </div>
    </>
  );
}
