'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const REASONS = ['scam', 'asks_for_payment', 'misleading', 'offensive', 'spam', 'other'] as const;

type Props = { targetType: 'JOB' | 'FORUM_THREAD' | 'FORUM_REPLY'; targetId: string; className?: string };

/** "Report": tell the Beleqet team about a scam, a request for payment, abuse or spam. */
export default function ReportButton({ targetType, targetId, className }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | ''>('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'already'>('idle');

  if (state === 'sent' || state === 'already') {
    return <span role="status" className="text-[13px] font-semibold text-forest dark:text-limeAccent">{t(state === 'sent' ? 'report.thanks' : 'report.already')}</span>;
  }
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)}`} className={className ?? 'text-[13px] font-semibold text-ink-500 hover:underline dark:text-slate-400'}>
        {t('report.action')}
      </Link>
    );
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!reason || (reason === 'other' && !details.trim())) return;
    setState('sending');
    try {
      const response = await authenticatedFetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details: details.trim() || undefined }),
      });
      if (response.status === 409) return setState('already');
      setState(response.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-ink-500 hover:underline dark:text-slate-400'}>
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {t('report.action')}
      </button>
    );
  }

  return (
    <form noValidate onSubmit={send} className="flex w-full flex-col gap-2 rounded-lg border border-ink-200 p-3 text-left dark:border-slate-700">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-1 text-sm font-bold text-ink-900 dark:text-white">{t('report.why')}</legend>
        {REASONS.map((item) => (
          <label key={item} className="flex items-center gap-2 text-sm text-ink-700 dark:text-slate-300">
            <input type="radio" name={`reason-${targetId}`} checked={reason === item} onChange={() => setReason(item)} className="h-4 w-4 accent-primary" />
            {t(`report.reasons.${item}`)}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm text-ink-700 dark:text-slate-300">
        {t(reason === 'other' ? 'report.detailsNeeded' : 'report.details')}
        <textarea rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className="rounded-lg border border-ink-300 bg-surface px-3 py-2 text-[15px] text-ink-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      </label>
      {state === 'failed' && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{t('report.failed')}</p>}
      <span className="flex flex-wrap gap-2">
        <button type="submit" disabled={!reason || state === 'sending' || (reason === 'other' && !details.trim())} className="inline-flex min-h-10 items-center rounded-lg bg-obsidian px-3.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-limeAccent dark:text-obsidian">
          {t(state === 'sending' ? 'report.sending' : 'report.send')}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center rounded-lg border border-ink-300 px-3.5 text-sm font-bold text-ink-900 dark:border-slate-700 dark:text-white">
          {t('postJob.cancel')}
        </button>
      </span>
    </form>
  );
}
