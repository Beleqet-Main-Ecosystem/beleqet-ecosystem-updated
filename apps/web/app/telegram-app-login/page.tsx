'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiError } from '@/lib/api-error';
import { botRegistrationUrl, TELEGRAM_LOGIN_BOT_ID } from '@/lib/telegram-login';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const APP_RETURN = 'beleqet://auth/callback';
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

type State = 'ready' | 'working' | 'unregistered' | 'failed' | 'badLink';

/** Telegram hands back its signed details as base64 JSON in #tgAuthResult=. */
function telegramResult(hash: string): Record<string, string | number> | null {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('tgAuthResult');
  if (!raw) return null;
  try {
    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/**
 * "Continue with Telegram" for the Android app. Telegram's sign-in only works on the domain set for
 * the Jobs bot (beleqetjobs.com), so the app opens this page with its challenge. The page sends the
 * person to Telegram's own sign-in page and back, gives the signed details to the API, and returns to
 * the app with a one-time code (src/modules/auth/app-oauth.ts). Full-page redirects, no popup: popups
 * don't work in the in-app browser the app signs in with.
 */
function TelegramAppLogin() {
  const { t, locale } = useTranslation();
  const params = useSearchParams();
  const challenge = params.get('app_challenge') ?? '';
  const [state, setState] = useState<State>('ready');

  useEffect(() => {
    if (!CHALLENGE.test(challenge)) return setState('badLink');
    const data = telegramResult(window.location.hash);
    if (!data) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setState('working');
    fetch(`${API_URL}/telegram/app-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, challenge }),
    })
      .then(async (response) => {
        if (!response.ok) throw await apiError(response);
        const { redirect } = (await response.json()) as { redirect: string };
        if (!redirect.startsWith(`${APP_RETURN}?`)) throw new Error('unexpected redirect');
        window.location.replace(redirect);
      })
      .catch((problem: { status?: number }) => setState(problem?.status === 404 ? 'unregistered' : 'failed'));
  }, [challenge]);

  function start() {
    const returnTo = `${window.location.origin}/telegram-app-login?app_challenge=${encodeURIComponent(challenge)}`;
    const query = new URLSearchParams({
      bot_id: TELEGRAM_LOGIN_BOT_ID,
      origin: window.location.origin,
      request_access: 'write',
      lang: locale,
      return_to: returnTo,
    });
    window.location.href = `https://oauth.telegram.org/auth?${query}`;
  }

  const back = (error?: string) => (window.location.href = error ? `${APP_RETURN}?error=${error}` : APP_RETURN);
  const solid = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';
  const outline = 'inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-ink-300 px-5 text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:text-white';
  const title = state === 'unregistered' ? 'appLogin.unregisteredTitle' : 'appLogin.title';
  const text = { ready: 'appLogin.text', working: 'appLogin.working', unregistered: 'appLogin.unregisteredText', failed: 'appLogin.failed', badLink: 'appLogin.badLink' }[state];

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col justify-center gap-4 px-4 py-10">
      <section className="flex flex-col items-center gap-3 rounded-xl border border-ink-200 bg-surface p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EEF5EF] text-forest dark:bg-forest/20 dark:text-limeAccent">
          <Send className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">{t(title)}</h1>
        <p role={state === 'failed' ? 'alert' : undefined} className="text-[15px] leading-relaxed text-ink-600 dark:text-slate-300">{t(text)}</p>
        {state === 'ready' && <button type="button" onClick={start} className={solid}>{t('appLogin.button')}</button>}
        {state === 'unregistered' && (
          <>
            <a href={botRegistrationUrl(null)} className={solid}>{t('appLogin.register')}</a>
            <button type="button" onClick={() => back('telegram-not-registered')} className={outline}>{t('appLogin.back')}</button>
          </>
        )}
        {state === 'failed' && <button type="button" onClick={() => back('telegram-failed')} className={outline}>{t('appLogin.back')}</button>}
      </section>
    </main>
  );
}

export default function TelegramAppLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <TelegramAppLogin />
    </Suspense>
  );
}
