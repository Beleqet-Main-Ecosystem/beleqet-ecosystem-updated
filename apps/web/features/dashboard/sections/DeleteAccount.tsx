'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { authenticatedFetch } from '@/lib/auth';
import { card, Field, input, muted, outline } from '../ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

/**
 * Delete my account. The password confirms it (Google and LinkedIn-only accounts leave it
 * blank), and typing DELETE stops a stray click. Open contracts must be settled first.
 */
export default function DeleteAccount() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (confirm !== 'DELETE') {
      setError(t('dash.deleteTypeIt'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await authenticatedFetch(`${API_URL}/v1/compliance/gdpr/erase-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password || undefined, confirm }),
      });
      if (response.status === 401) throw new Error(t('dash.deleteWrongPassword'));
      if (response.status === 409) throw new Error(t('dash.deleteOpenContracts'));
      if (!response.ok) throw new Error(t('dash.deleteFailed'));
      logout();
      router.replace('/?account=deleted');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t('dash.deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <section className={`${card} flex flex-col gap-2`}>
      <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.privacy')}</h2>
      <b className="text-[15px] text-ink-900 dark:text-white">{t('dash.deleteTitle')}</b>
      <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('dash.deleteExplain')}</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${outline} self-start border-[#F2B8B5] text-[#B42318] dark:border-red-900 dark:text-red-300`}>
          {t('dash.deleteStart')}
        </button>
      ) : (
        <form noValidate onSubmit={submit} className="mt-1 flex flex-col gap-3 rounded-lg border border-[#F2B8B5] p-4 dark:border-red-900">
          <Field label={t('dash.deletePassword')}>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </Field>
          <span className={muted}>{t('dash.deleteSocialNote')}</span>
          <Field label={t('dash.deleteConfirm')}>
            <input type="text" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value.trim())} className={`${input} max-w-[200px] uppercase`} />
          </Field>
          {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center rounded-lg bg-[#B42318] px-4 text-sm font-bold text-white disabled:opacity-60">
              {t(busy ? 'dash.deleting' : 'dash.deleteNow')}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(''); }} className={outline}>{t('postJob.cancel')}</button>
          </span>
        </form>
      )}
    </section>
  );
}
