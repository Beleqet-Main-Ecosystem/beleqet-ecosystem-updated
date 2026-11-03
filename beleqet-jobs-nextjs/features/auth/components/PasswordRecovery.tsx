'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleAlert, MailCheck, ShieldCheck } from 'lucide-react';
import { requestPasswordReset, resetPassword, verifyEmail } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import AuthLayout from './AuthLayout';
import { focusRing, FormError, Heading, PasswordField, SubmitButton, TextField } from './fields';
import { friendly } from './SignInForm';

const MIN_PASSWORD = 8;

function Badge({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  return (
    <span
      className={`grid h-16 w-16 place-items-center rounded-2xl ${tone === 'ok' ? 'bg-limeAccent text-obsidian' : 'bg-[#FDECEC] text-[#B42318]'}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function BackToSignIn() {
  const { t } = useTranslation();
  return (
    <Link href="/login" className={`self-center rounded px-2 py-2 text-[15px] font-semibold text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
      ← {t('auth.backToSignIn')}
    </Link>
  );
}

const primaryLink = `flex min-h-[50px] items-center justify-center rounded-md bg-primary text-base font-extrabold text-limeAccent dark:bg-limeAccent dark:text-obsidian ${focusRing}`;

/** Step 1 of recovery: ask for the email. The answer is the same whether or not the account exists. */
export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendly(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthLayout>
        <Badge tone="ok"><MailCheck className="h-[30px] w-[30px]" /></Badge>
        <Heading
          title={t('auth.resetSentTitle')}
          sub={
            <>
              {t('auth.resetSentSub1')} <b className="text-ink-900 dark:text-white">{email.trim()}</b>{t('auth.resetSentSub2')}
            </>
          }
        />
        <BackToSignIn />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Heading title={t('auth.resetTitle')} sub={t('auth.resetSub')} />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel={t('auth.sending')}>{t('auth.sendLink')}</SubmitButton>
      </form>
      <BackToSignIn />
    </AuthLayout>
  );
}

/** Step 2 of recovery: the link from the email lands here with ?token=. */
export function ResetPasswordForm() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token')), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || password.length < MIN_PASSWORD) return;
    setBusy(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid|expired/i.test(message) ? t('auth.linkExpired') : friendly(err, t));
    } finally {
      setBusy(false);
    }
  }

  if (token === null) {
    return (
      <AuthLayout>
        <Badge tone="warn"><CircleAlert className="h-[30px] w-[30px]" /></Badge>
        <Heading title={t('auth.badLinkTitle')} sub={t('auth.badResetLink')} />
        <Link href="/forgot-password" className={primaryLink}>{t('auth.requestNewLink')}</Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <Badge tone="ok"><ShieldCheck className="h-[30px] w-[30px]" /></Badge>
        <Heading title={t('auth.passwordChangedTitle')} sub={t('auth.passwordChangedSub')} />
        <Link href="/login" className={primaryLink}>{t('auth.signIn')}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Heading title={t('auth.newPasswordTitle')} sub={t('auth.newPasswordSub')} />
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PasswordField
          label={t('auth.newPassword')}
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t('auth.passwordHint')}
          error={password.length > 0 && password.length < MIN_PASSWORD ? t('auth.passwordShort').replace('{n}', String(MIN_PASSWORD)) : undefined}
        />
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel={t('auth.saving')} disabled={!token || password.length < MIN_PASSWORD}>
          {t('auth.savePassword')}
        </SubmitButton>
      </form>
      {error && (
        <Link href="/forgot-password" className="self-center text-[15px] font-semibold text-forest hover:underline dark:text-limeAccent">
          {t('auth.requestNewLink')}
        </Link>
      )}
    </AuthLayout>
  );
}

/** The link in the welcome email lands here with ?token=. */
export function VerifyEmailStatus() {
  const { t } = useTranslation();
  const [state, setState] = useState<'checking' | 'ok' | 'bad'>('checking');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('bad');
      return;
    }
    verifyEmail(token)
      .then(() => setState('ok'))
      .catch(() => setState('bad'));
  }, []);

  return (
    <AuthLayout>
      {state === 'checking' && (
        <p role="status" className="text-[15px] text-ink-600 dark:text-slate-400">{t('auth.verifying')}</p>
      )}
      {state === 'ok' && (
        <>
          <Badge tone="ok"><MailCheck className="h-[30px] w-[30px]" /></Badge>
          <Heading title={t('auth.verifiedTitle')} sub={t('auth.verifiedSub')} />
          <Link href="/dashboard" className={primaryLink}>{t('auth.goToDashboard')}</Link>
        </>
      )}
      {state === 'bad' && (
        <>
          <Badge tone="warn"><CircleAlert className="h-[30px] w-[30px]" /></Badge>
          <Heading title={t('auth.badLinkTitle')} sub={t('auth.badVerifyLink')} />
          <BackToSignIn />
        </>
      )}
    </AuthLayout>
  );
}
