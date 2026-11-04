'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, MailCheck, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import { UserRole } from '@beleqet/common';
import { useAuth } from '@/components/AuthProvider';
import { registerUser, type AuthUser } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { homeFor, safeNextPath } from '../redirect';
import AuthLayout, { type BrandVariant } from './AuthLayout';
import { focusRing, FormError, Heading, PasswordField, SubmitButton, TextField } from './fields';
import SocialButtons from './SocialButtons';
import { friendly } from './SignInForm';

type Role = BrandVariant;

const ROLES: { id: Role; icon: LucideIcon; param: string }[] = [
  { id: 'JOB_SEEKER', icon: Search, param: 'job-seeker' },
  { id: 'EMPLOYER', icon: BriefcaseBusiness, param: 'employer' },
  { id: 'FREELANCER', icon: ShieldCheck, param: 'freelancer' },
];

const MIN_PASSWORD = 8;

/** The account type asked for with `?role=`, if any. */
function requestedRole() {
  const param = new URLSearchParams(window.location.search).get('role')?.toLowerCase();
  return ROLES.find((r) => r.param === param || r.id.toLowerCase() === param);
}

/** Two steps: what you'll use Beleqet for, then your details. `?role=employer` skips step 1. */
export default function RegisterFlow() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, ready, setUser, logout } = useAuth();
  const [step, setStep] = useState<'role' | 'details' | 'done'>('role');
  const [role, setRole] = useState<Role>('JOB_SEEKER');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<AuthUser | null>(null);
  // Signed in already, but asked for a different kind of account (e.g. "Create employer account" on Post a job).
  const [otherRole, setOtherRole] = useState(false);

  useEffect(() => {
    const match = requestedRole();
    if (match) {
      setRole(match.id);
      setStep('details');
    }
  }, []);

  // Signed-in visitors don't need this page (but stay on the confirmation after signing up). Roles
  // can't be changed by their owner, so asking for another one explains that instead of silently
  // dropping them on their own dashboard.
  useEffect(() => {
    if (!ready || !user || step === 'done') return;
    const match = requestedRole();
    if (match && match.id !== user.role) setOtherRole(true);
    else router.replace(homeFor(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });
  const passwordShort = form.password.length > 0 && form.password.length < MIN_PASSWORD;
  const missing = !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || form.password.length < MIN_PASSWORD || !agreed;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (missing) return;
    setBusy(true);
    setError('');
    try {
      const signedIn = await registerUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: UserRole[role],
      });
      setCreated(signedIn);
      setStep('done');
      setUser(signedIn);
    } catch (err) {
      setError(friendly(err, t));
    } finally {
      setBusy(false);
    }
  }

  const roleTitle = t(`auth.roles.${role}.short`);
  const signInHref = (() => {
    if (typeof window === 'undefined') return '/login';
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
  })();

  if (otherRole && user) {
    return (
      <AuthLayout brand={role}>
        <Heading
          title={t('auth.otherRoleTitle').replace('{role}', t(`auth.roles.${role}.short`))}
          sub={t('auth.otherRoleText')
            .replace('{current}', t(`auth.roles.${user.role}.short`))
            .replace('{email}', user.email)
            .replace('{role}', t(`auth.roles.${role}.short`))}
        />
        <button
          type="button"
          onClick={() => {
            logout();
            setOtherRole(false);
          }}
          className={`flex min-h-[50px] items-center justify-center rounded-md bg-primary text-base font-extrabold text-limeAccent dark:bg-limeAccent dark:text-obsidian ${focusRing}`}
        >
          {t('auth.signOutContinue')}
        </button>
        <Link href={homeFor(user)} className={`self-center rounded text-sm font-bold text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
          {t('auth.goToDashboard')}
        </Link>
      </AuthLayout>
    );
  }

  if (step === 'done' && created) {
    const next = typeof window !== 'undefined' ? safeNextPath(new URLSearchParams(window.location.search).get('next')) : null;
    return (
      <AuthLayout brand={role}>
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-limeAccent text-obsidian" aria-hidden="true">
          <MailCheck className="h-[30px] w-[30px]" />
        </span>
        <Heading
          title={t('auth.checkEmail')}
          sub={
            <>
              {t('auth.checkEmailSub1')} <b className="text-ink-900 dark:text-white">{created.email}</b>. {t('auth.checkEmailSub2')}
            </>
          }
        />
        <Link
          href={next ?? homeFor(created)}
          className={`flex min-h-[50px] items-center justify-center rounded-md bg-primary text-base font-extrabold text-limeAccent dark:bg-limeAccent dark:text-obsidian ${focusRing}`}
        >
          {t('auth.continue')}
        </Link>
        <p className="text-sm text-ink-600 dark:text-slate-400">{t('auth.noEmail')}</p>
      </AuthLayout>
    );
  }

  if (step === 'role') {
    return (
      <AuthLayout brand={role}>
        <Heading
          eyebrow={<span className="text-[13px] font-bold text-forest dark:text-limeAccent">{t('auth.step1')}</span>}
          title={t('auth.roleTitle')}
          sub={t('auth.roleSub')}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep('details');
          }}
          className="flex flex-col gap-[22px]"
        >
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">{t('auth.roleTitle')}</legend>
            {ROLES.map((r) => {
              const on = r.id === role;
              return (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-xl bg-surface focus-within:ring-2 focus-within:ring-forest focus-within:ring-offset-2 dark:bg-slate-900 ${
                    on ? 'border-2 border-primary p-4 dark:border-limeAccent' : 'border border-ink-300 p-[17px] dark:border-slate-700'
                  }`}
                >
                  <input type="radio" name="role" value={r.id} checked={on} onChange={() => setRole(r.id)} className="sr-only" />
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${on ? 'bg-primary text-limeAccent' : 'bg-[#EEF5EF] text-forest dark:bg-forest/20 dark:text-limeAccent'}`} aria-hidden="true">
                    <r.icon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-1 flex-col gap-[3px]">
                    <b className="text-base text-ink-900 dark:text-white">{t(`auth.roles.${r.id}.title`)}</b>
                    <span className="text-sm leading-snug text-ink-600 dark:text-slate-400">{t(`auth.roles.${r.id}.text`)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <SubmitButton>{t('auth.continue')}</SubmitButton>
        </form>
        <p className="text-center text-[15px] text-ink-600 dark:text-slate-400">
          {t('auth.haveAccount')}{' '}
          <Link href={signInHref} className="font-bold text-forest hover:underline dark:text-limeAccent">{t('auth.signIn')}</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout brand={role}>
      <Heading
        eyebrow={
          <button type="button" onClick={() => setStep('role')} className={`self-start rounded text-sm font-bold text-forest dark:text-limeAccent ${focusRing}`}>
            ← {t('auth.step1')}
          </button>
        }
        title={t('auth.createTitle')}
        sub={
          <>
            {t('auth.signingUpAs')} <b className="text-ink-900 dark:text-white">{roleTitle}</b>
          </>
        }
      />
      {/* Google and LinkedIn accounts start as job seekers, so only offer them for that role. */}
      {role === 'JOB_SEEKER' && <SocialButtons />}
      <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate>
        <div className="grid grid-cols-2 gap-2.5">
          <TextField label={t('auth.firstName')} autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} error={touched && !form.firstName.trim() ? t('auth.required') : undefined} />
          <TextField label={t('auth.lastName')} autoComplete="family-name" required value={form.lastName} onChange={set('lastName')} error={touched && !form.lastName.trim() ? t('auth.required') : undefined} />
        </div>
        <TextField label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" error={touched && !form.email.trim() ? t('auth.required') : undefined} />
        <PasswordField
          label={t('auth.password')}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={form.password}
          onChange={set('password')}
          hint={t('auth.passwordHint')}
          error={passwordShort || (touched && form.password.length < MIN_PASSWORD) ? t('auth.passwordShort').replace('{n}', String(MIN_PASSWORD)) : undefined}
        />
        <label className="flex items-start gap-2.5 text-sm leading-normal text-ink-700 dark:text-slate-300">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
          <span>
            {t('auth.agree')}{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-forest underline dark:text-limeAccent">{t('footer.privacy')}</Link>.
          </span>
        </label>
        {touched && !agreed && <span className="-mt-2 text-[13px] font-semibold text-[#B42318]">{t('auth.agreeRequired')}</span>}
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel={t('auth.creating')}>{t('auth.createAccount')}</SubmitButton>
      </form>
      <p className="text-center text-[15px] text-ink-600 dark:text-slate-400">
        {t('auth.haveAccount')}{' '}
        <Link href={signInHref} className="font-bold text-forest hover:underline dark:text-limeAccent">{t('auth.signIn')}</Link>
      </p>
    </AuthLayout>
  );
}
