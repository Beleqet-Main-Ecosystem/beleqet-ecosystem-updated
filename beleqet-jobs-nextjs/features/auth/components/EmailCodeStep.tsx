'use client';

import { useEffect, useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { resendEmailCode, verifyEmailCode, type AuthUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import AuthLayout from './AuthLayout';
import { focusRing, FormError, Heading, SubmitButton } from './fields';
import { friendly } from './SignInForm';

const RESEND_SECONDS = 60;

type Props = {
  email: string;
  verificationToken: string;
  onSignedIn: (user: AuthUser) => void;
  /** The account also has two-step sign-in: continue with its authenticator code. */
  onTwoFactor: (tempToken: string) => void;
  onBack: () => void;
};

/**
 * The 6-digit code emailed at sign-up (or when a new account signs in before confirming).
 * Entering it confirms the address and signs the account in; there is no way past it without.
 */
export default function EmailCodeStep({ email, verificationToken, onSignedIn, onTwoFactor, onBack }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  // Count down to the next allowed resend (the API sends at most one code a minute).
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await verifyEmailCode(verificationToken, code);
      if (result.status === 'signed-in') onSignedIn(result.user);
      else if (result.status === 'needs-code') onTwoFactor(result.tempToken);
    } catch (err) {
      setError(friendly(err, t));
      setCode('');
      setBusy(false);
      codeRef.current?.focus();
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    try {
      const result = await resendEmailCode(verificationToken);
      if (result.alreadyVerified) {
        onBack();
        return;
      }
      setNotice(t('auth.emailCodeSent'));
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(friendly(err, t));
    }
  }

  return (
    <AuthLayout>
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-limeAccent text-obsidian" aria-hidden="true">
        <MailCheck className="h-[30px] w-[30px]" />
      </span>
      <Heading
        title={t('auth.checkEmail')}
        sub={
          <>
            {t('auth.emailCodeSub1')} <b className="text-ink-900 dark:text-white">{email}</b>. {t('auth.emailCodeSub2')}
          </>
        }
      />
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-900 dark:text-white">{t('auth.emailCodeLabel')}</span>
          {/* One real input (paste, autofill, screen readers) drawn as six boxes. */}
          <span className="relative block">
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-describedby="email-code-help"
              className="peer absolute inset-0 z-10 h-14 w-full cursor-text opacity-0"
            />
            <span aria-hidden="true" className="grid grid-cols-6 gap-2 rounded-md peer-focus:ring-2 peer-focus:ring-forest peer-focus:ring-offset-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="grid h-14 place-items-center rounded-md border border-ink-300 bg-surface text-[22px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {code[i] ?? ''}
                </span>
              ))}
            </span>
          </span>
        </label>
        <FormError message={error} />
        {notice && (
          <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">
            {notice}
          </p>
        )}
        <SubmitButton busy={busy} busyLabel={t('auth.checking')} disabled={code.length !== 6}>
          {t('auth.emailCodeVerify')}
        </SubmitButton>
      </form>
      <p id="email-code-help" className="text-sm text-ink-600 dark:text-slate-400">
        {t('auth.emailCodeSpam')}
      </p>
      <div className="flex flex-col items-center gap-2 text-[15px]">
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0}
          className={`min-h-11 rounded px-2 font-semibold text-forest disabled:text-ink-500 dark:text-limeAccent dark:disabled:text-slate-500 ${focusRing}`}
        >
          {wait > 0 ? t('auth.emailCodeResendIn').replace('{s}', String(wait)) : t('auth.emailCodeResend')}
        </button>
        <button type="button" onClick={onBack} className={`min-h-11 rounded px-2 text-ink-600 hover:underline dark:text-slate-400 ${focusRing}`}>
          {t('auth.emailCodeBack')}
        </button>
      </div>
    </AuthLayout>
  );
}
