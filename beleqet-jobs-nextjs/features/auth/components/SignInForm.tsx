'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { completeTwoFactor, loginUser, setKeepSignedIn, type AuthUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { homeFor, safeNextPath } from '../redirect';
import AuthLayout from './AuthLayout';
import { focusRing, FormError, Heading, PasswordField, SubmitButton, TextField } from './fields';

export default function SignInForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, ready, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [codeKind, setCodeKind] = useState<'app' | 'backup'>('app');
  const [code, setCode] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  const next = () => safeNextPath(new URLSearchParams(window.location.search).get('next'));
  const finish = (signedIn: AuthUser) => {
    setKeepSignedIn(keep);
    setUser(signedIn);
    router.replace(next() ?? homeFor(signedIn));
  };

  // Already signed in: go where they were headed.
  useEffect(() => {
    if (ready && user && !busy) router.replace(next() ?? homeFor(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  useEffect(() => {
    if (tempToken) codeRef.current?.focus();
  }, [tempToken, codeKind]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await loginUser({ email: email.trim(), password });
      if (result.status === 'needs-code') {
        setTempToken(result.tempToken);
        setBusy(false);
        return;
      }
      finish(result.user);
    } catch (err) {
      setError(friendly(err, t));
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!tempToken) return;
    setBusy(true);
    setError('');
    try {
      finish(await completeTwoFactor(tempToken, code.trim(), codeKind));
    } catch (err) {
      setError(friendly(err, t));
      setBusy(false);
    }
  }

  if (tempToken) {
    const app = codeKind === 'app';
    return (
      <AuthLayout>
        <Heading title={t(app ? 'auth.codeTitle' : 'auth.backupTitle')} sub={t(app ? 'auth.codeSub' : 'auth.backupSub')} />
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink-900 dark:text-white">{t(app ? 'auth.codeLabel' : 'auth.backupLabel')}</span>
            {/* One real input (paste, autofill, screen readers) drawn as six boxes for app codes. */}
            <span className="relative block">
              <input
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(app ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value.replace(/\s/g, '').slice(0, 10))}
                inputMode={app ? 'numeric' : 'text'}
                autoComplete="one-time-code"
                className={
                  app
                    ? 'peer absolute inset-0 z-10 h-14 w-full cursor-text opacity-0'
                    : 'min-h-14 w-full rounded-md border border-ink-300 bg-surface px-4 text-center font-mono text-2xl font-bold tracking-[0.3em] text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-900 dark:text-white'
                }
              />
              {app && (
                <span aria-hidden="true" className="grid grid-cols-6 gap-2 rounded-md peer-focus:ring-2 peer-focus:ring-forest peer-focus:ring-offset-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="grid h-14 place-items-center rounded-md border border-ink-300 bg-surface text-[22px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                      {code[i] ?? ''}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </label>
          <FormError message={error} />
          <SubmitButton busy={busy} busyLabel={t('auth.checking')} disabled={code.length !== (app ? 6 : 10)}>
            {t('auth.verify')}
          </SubmitButton>
        </form>
        <div className="flex flex-col items-center gap-2 text-[15px]">
          <button
            type="button"
            onClick={() => {
              setCodeKind(app ? 'backup' : 'app');
              setCode('');
              setError('');
            }}
            className={`min-h-11 rounded px-2 font-semibold text-forest dark:text-limeAccent ${focusRing}`}
          >
            {t(app ? 'auth.useBackup' : 'auth.useApp')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTempToken(null);
              setCode('');
              setError('');
            }}
            className={`min-h-11 rounded px-2 font-semibold text-ink-700 dark:text-slate-300 ${focusRing}`}
          >
            ← {t('auth.backToSignIn')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Heading title={t('auth.welcomeBack')} sub={t('auth.signInSub')} />
      <form onSubmit={signIn} className="flex flex-col gap-4">
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelAction={
            <Link href="/forgot-password" className="text-sm font-semibold text-forest hover:underline dark:text-limeAccent">
              {t('auth.forgot')}
            </Link>
          }
        />
        <label className="flex items-center gap-2.5 text-sm text-ink-700 dark:text-slate-300">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-5 w-5 accent-primary" />
          {t('auth.keepSignedIn')}
        </label>
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel={t('auth.signingIn')}>{t('auth.signIn')}</SubmitButton>
      </form>
      <p className="text-center text-[15px] text-ink-600 dark:text-slate-400">
        {t('auth.newHere')}{' '}
        <Link href={registerHref()} className="font-bold text-forest hover:underline dark:text-limeAccent">
          {t('auth.createAccount')}
        </Link>
      </p>
    </AuthLayout>
  );
}

/** Keep `next` when switching to registration so the person lands where they started. */
function registerHref() {
  if (typeof window === 'undefined') return '/register';
  const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
  return next ? `/register?next=${encodeURIComponent(next)}` : '/register';
}

/** API messages are English and technical; map the common ones to plain, translated text. */
export function friendly(err: unknown, t: (k: string) => string): string {
  const message = err instanceof Error ? err.message : '';
  if (/social login/i.test(message)) return t('auth.errSocial');
  if (/invalid credentials|unauthorized|incorrect|wrong password/i.test(message)) return t('auth.errCredentials');
  if (/invalid code|expired verification|invalid or expired token/i.test(message)) return t('auth.errCode');
  if (/already registered/i.test(message)) return t('auth.errExists');
  if (/too many|throttl/i.test(message)) return t('auth.errTooMany');
  if (/cannot reach the server/i.test(message)) return t('auth.errNetwork');
  if (/deactivated|disabled|inactive/i.test(message)) return t('auth.errDisabled');
  return message || t('auth.errGeneric');
}
