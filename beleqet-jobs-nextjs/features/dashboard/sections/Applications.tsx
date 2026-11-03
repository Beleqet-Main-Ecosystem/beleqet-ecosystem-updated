'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { initials } from '@/features/jobs/format';
import { apiSend, fetchApplications, type Application } from '../api';
import { card, Confirm, Empty, Failed, Heading, muted, outline, shortDate, solid } from '../ui';

const STEPS = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED'] as const;
const CLOSED = ['REJECTED', 'WITHDRAWN'];
/** The only statuses the API lets a candidate withdraw from. */
const CAN_WITHDRAW = ['SUBMITTED', 'SCREENING', 'SHORTLISTED'];
const FILTERS = ['all', 'active', 'interview', 'closed'] as const;

export default function Applications() {
  const { t, locale } = useTranslation();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [withdrawing, setWithdrawing] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    fetchApplications().then(setApps).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!apps) return <div className="min-h-[40vh]" />;

  const shown = apps.filter((app) => {
    if (filter === 'active') return !CLOSED.includes(app.status);
    if (filter === 'interview') return app.status === 'INTERVIEW_SCHEDULED';
    if (filter === 'closed') return CLOSED.includes(app.status);
    return true;
  });

  async function withdraw() {
    if (!withdrawing) return;
    setBusy(true);
    setError('');
    try {
      await apiSend('PATCH', `/applications/${withdrawing.id}/withdraw`);
      setApps((list) => (list ?? []).map((app) => (app.id === withdrawing.id ? { ...app, status: 'WITHDRAWN' } : app)));
    } catch {
      setError(t('freelance.gig.actionFailed'));
    } finally {
      setBusy(false);
      setWithdrawing(null);
    }
  }

  return (
    <>
      <Heading title={t('dash.appsTitle')} sub={t('dash.appsSub')} />
      <div role="group" aria-label={t('freelance.categories')} className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={`min-h-10 rounded-full border px-3.5 text-sm ${filter === item ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
          >
            {t(`dash.filters.${item}`)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

      {shown.length === 0 ? (
        <Empty title={t('dash.nothing')} text={t('dash.nothingText')}>
          <Link href="/jobs" className={`${solid} mt-2`}>{t('dash.browse')}</Link>
        </Empty>
      ) : (
        shown.map((app) => {
          const closed = CLOSED.includes(app.status);
          const reached = STEPS.indexOf(app.status as (typeof STEPS)[number]);
          const company = app.job.company?.name ?? '';
          return (
            <article key={app.id} className={`${card} flex flex-col gap-3.5`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">{initials(company || app.job.title)}</span>
                <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <Link href={`/jobs/${app.jobId}`} prefetch={false} className="font-bold text-ink-900 hover:underline dark:text-white">{app.job.title}</Link>
                  <span className={muted}>{[company, t('dash.applied').replace('{date}', shortDate(app.createdAt, locale))].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${closed ? 'bg-[#F1F4F6] text-ink-500 dark:bg-slate-800 dark:text-slate-300' : 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent'}`}>
                  {t(`dash.status.${app.status}`)}
                </span>
              </div>
              {!closed && (
                <ol aria-label={t('freelance.post2.progress')} className="grid grid-cols-5 gap-1.5">
                  {STEPS.map((step, index) => (
                    <li key={step} aria-current={index === reached ? 'step' : undefined} className="flex min-w-0 flex-col gap-1">
                      <span className={`h-1 rounded-full ${index <= reached ? 'bg-forest dark:bg-limeAccent' : 'bg-ink-200 dark:bg-slate-800'}`} />
                      <span className="hidden truncate text-xs text-ink-500 md:block dark:text-slate-400">{t(`dash.status.${step}`)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {CAN_WITHDRAW.includes(app.status) && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setWithdrawing(app)} className={outline}>{t('dash.withdraw')}</button>
                </div>
              )}
            </article>
          );
        })
      )}

      {withdrawing && (
        <Confirm
          title={t('dash.withdrawTitle')}
          text={t('dash.withdrawText')}
          cancel={t('dash.keepIt')}
          confirm={t('dash.withdraw')}
          busy={busy}
          onCancel={() => setWithdrawing(null)}
          onConfirm={withdraw}
        />
      )}
    </>
  );
}
