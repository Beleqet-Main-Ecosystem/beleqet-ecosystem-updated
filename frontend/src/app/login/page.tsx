'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Field, card, input, link, muted, solid } from '@/components/ui';
import { NotAdminError, completeTwoFactor, login } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/** Only paths inside this app; never an outside address from ?next=. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/dashboard';
}

function LoginForm() {
  const { t } = useI18n();
  const { user, ready, setUser } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, router, next]);

  async function attempt(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof NotAdminError ? t('login.notAdmin') : failure instanceof Error ? failure.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    void attempt(async () => {
      const result = await login(email.trim(), password);
      if (result.status === 'needs-code') setTempToken(result.tempToken);
      else setUser(result.user);
    });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (!tempToken) return;
    void attempt(async () => setUser(await completeTwoFactor(tempToken, code.trim(), backup ? 'backup' : 'app')));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className={`${card} flex w-full max-w-[400px] flex-col gap-5 !p-6 sm:!p-8`}>
        <div className="flex items-center gap-3">
          <Image src="/logo-icon.png" alt="" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-xl font-extrabold text-ink-900 dark:text-white">{t('login.title')}</h1>
            <p className={muted}>{tempToken ? t('login.codeSub') : t('login.sub')}</p>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

        {!tempToken ? (
          <form onSubmit={submitPassword} className="flex flex-col gap-4">
            <Field label={t('login.email')}>
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </Field>
            <Field label={t('login.password')}>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
            </Field>
            <button type="submit" disabled={busy} className={solid}>{busy ? t('common.working') : t('login.submit')}</button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <Field label={backup ? t('login.backupCode') : t('login.appCode')}>
              <input
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={backup ? 'text' : 'numeric'}
                pattern={backup ? undefined : '[0-9]{6}'}
                maxLength={backup ? 20 : 6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${input} tracking-[0.2em]`}
              />
            </Field>
            <button type="submit" disabled={busy} className={solid}>{busy ? t('common.working') : t('login.verify')}</button>
            <button type="button" className={`${link} text-left text-sm`} onClick={() => { setBackup(!backup); setCode(''); }}>
              {backup ? t('login.useApp') : t('login.useBackup')}
            </button>
            <button type="button" className={`${link} text-left text-sm`} onClick={() => { setTempToken(null); setCode(''); setPassword(''); }}>
              {t('login.startOver')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
