'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { askTelegram } from '@/lib/telegram-login';
import { errorText } from '@/lib/api-error';
import { apiSend, fetchProfile, type Profile } from '../api';
import { card, Field, input, link, muted, outline, solid } from '../ui';

// What the email row is doing: nothing, asking for an address, or waiting for the emailed code.
type Step = 'idle' | 'email' | 'code';

const title = 'text-lg font-bold text-ink-900 dark:text-white';
const row = 'flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F4F6] pt-3 dark:border-slate-800';

/**
 * How this account signs in: its email (or adding one, for accounts made in Telegram), the
 * Telegram account connected to it, and every way in it has.
 */
export default function SignInSection() {
  const { t, locale } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    fetchProfile().then(setProfile).catch(() => setProfile(null));
  }, []);
  useEffect(load, [load]);

  if (!profile) return null;

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (problem) {
      setError(errorText(problem, t, failure));
    } finally {
      setBusy(false);
    }
  }

  // With a typed address it's set first (Telegram-only accounts); otherwise the code goes to the current one.
  const sendCode = (event?: FormEvent) => {
    event?.preventDefault();
    void run(async () => {
      const answer = await apiSend<{ sent: boolean; already_confirmed?: boolean; email: string }>(
        'POST',
        '/auth/email',
        step === 'email' ? { email: email.trim() } : {},
      );
      if (answer.already_confirmed) {
        setStep('idle');
        load();
        return;
      }
      setSentTo(answer.email);
      setCode('');
      setStep('code');
    }, 'dash.signIn.sendFailed');
  };

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiSend('POST', '/auth/email/confirm', { code });
      setStep('idle');
      setNotice(t('dash.signIn.confirmed'));
      load();
    }, 'dash.signIn.confirmFailed');
  };

  const connect = () =>
    run(async () => {
      const { data, failed } = await askTelegram(locale);
      if (!data) {
        if (failed) setError(t('auth.telegramFailed'));
        return;
      }
      await apiSend('POST', '/telegram/connect', { data });
      setNotice(t('dash.signIn.telegramConnected'));
      load();
    }, 'dash.signIn.telegramFailed');

  const methods = profile.signInMethods ?? [];

  return (
    <section className={`${card} flex flex-col gap-3`} aria-labelledby="sign-in-title">
      <div className="flex flex-col gap-1">
        <h2 id="sign-in-title" className={title}>{t('dash.signIn.title')}</h2>
        {methods.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('dash.signIn.methodsLabel')}>
            {methods.map((method) => (
              <li key={method} className="rounded-full bg-[#EEF5EF] px-2.5 py-0.5 text-xs font-bold text-forest dark:bg-slate-800 dark:text-limeAccent">
                {t(`dash.signIn.methods.${method}`)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={row}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('dash.signIn.email')}</b>
          <span className={`break-all ${muted}`}>
            {profile.email
              ? `${profile.email} · ${t(profile.emailVerified ? 'dash.signIn.confirmedBadge' : 'dash.signIn.unconfirmed')}`
              : t('dash.signIn.noEmail')}
          </span>
        </span>
        {step === 'idle' && !profile.email && (
          <button type="button" onClick={() => setStep('email')} className={outline}>{t('dash.signIn.addEmail')}</button>
        )}
        {step === 'idle' && profile.email && !profile.emailVerified && (
          <button type="button" onClick={() => sendCode()} disabled={busy} className={outline}>{t('dash.signIn.sendCode')}</button>
        )}
      </div>

      {step === 'email' && (
        <form noValidate onSubmit={sendCode} className="flex flex-col gap-3">
          <p className={muted}>{t('dash.signIn.addEmailText')}</p>
          <Field label={t('dash.signIn.email')}>
            <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} className={input} />
          </Field>
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !email.trim()} className={solid}>{t('dash.signIn.sendCode')}</button>
            <button type="button" onClick={() => setStep('idle')} className={outline}>{t('dash.signIn.cancel')}</button>
          </span>
        </form>
      )}

      {step === 'code' && (
        <form noValidate onSubmit={confirm} className="flex flex-col gap-3">
          <p className={muted}>{t('dash.signIn.codeSent').replace('{email}', sentTo)}</p>
          <Field label={t('dash.signIn.code')}>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(event) => setCode(event.target.value)} className={input} />
          </Field>
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6} className={solid}>{t('dash.signIn.confirm')}</button>
            <button type="button" onClick={() => sendCode()} disabled={busy} className={outline}>{t('dash.signIn.resend')}</button>
            <button type="button" onClick={() => setStep('idle')} className={outline}>{t('dash.signIn.cancel')}</button>
          </span>
        </form>
      )}

      {profile.email && profile.emailVerified && !methods.includes('PASSWORD') && (
        <p className={muted}>
          {t('dash.signIn.setPassword')} <Link href="/forgot-password" className={link}>{t('dash.signIn.setPasswordLink')}</Link>
        </p>
      )}

      <div className={row}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <b className="text-[15px] text-ink-900 dark:text-white">Telegram</b>
          <span className={muted}>
            {profile.telegramId
              ? `${t('dash.signIn.telegramOn')}${profile.telegramUsername ? ` · @${profile.telegramUsername}` : ''}`
              : t('dash.signIn.telegramOff')}
          </span>
        </span>
        {!profile.telegramId && (
          <button type="button" onClick={connect} disabled={busy} className={outline}>{t('dash.signIn.connectTelegram')}</button>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm font-bold text-forest dark:text-limeAccent">{notice}</p>}
    </section>
  );
}
