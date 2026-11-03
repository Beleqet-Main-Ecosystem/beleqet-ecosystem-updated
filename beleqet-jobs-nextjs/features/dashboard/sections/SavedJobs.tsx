'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { daysUntil, initials } from '@/features/jobs/format';
import { apiGet, apiSend } from '../api';
import { card, Empty, Failed, Heading, muted, outline, shortDate, solid } from '../ui';

type Saved = {
  jobId: string;
  job: { title: string; location?: string; deadline?: string | null; status?: string; company?: { name?: string } | null };
};

export default function SavedJobs() {
  const { t, locale } = useTranslation();
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Saved[]>('/users/saved-jobs').then(setSaved).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!saved) return <div className="min-h-[40vh]" />;

  async function remove(jobId: string) {
    setError('');
    try {
      await apiSend('DELETE', `/users/saved-jobs/${jobId}`);
      setSaved((list) => (list ?? []).filter((item) => item.jobId !== jobId));
    } catch {
      setError(t('freelance.gig.actionFailed'));
    }
  }

  // Soonest deadline first; jobs with no deadline go last.
  const sorted = [...saved].sort((a, b) => (a.job.deadline ?? '9').localeCompare(b.job.deadline ?? '9'));

  return (
    <>
      <Heading title={t('dash.savedTitle')} sub={t('dash.savedSub')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {sorted.length === 0 ? (
        <Empty title={t('dash.noSaved')} text={t('dash.noSavedText')}>
          <Link href="/jobs" className={`${solid} mt-2`}>{t('dash.browse')}</Link>
        </Empty>
      ) : (
        sorted.map(({ jobId, job }) => {
          const left = daysUntil(job.deadline);
          const open = job.status !== 'CLOSED' && (left === null || left >= 0);
          const company = job.company?.name ?? '';
          return (
            <article key={jobId} className={`${card} flex flex-wrap items-center gap-3`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">{initials(company || job.title)}</span>
              <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <Link href={`/jobs/${jobId}`} prefetch={false} className="font-bold text-ink-900 hover:underline dark:text-white">{job.title}</Link>
                <span className={muted}>{[company, job.location].filter(Boolean).join(' · ')}</span>
                <span className={muted}>
                  {!open ? t('dash.noLonger') : job.deadline ? t('dash.closes').replace('{date}', shortDate(job.deadline, locale)) : t('dash.noDeadline')}
                </span>
              </span>
              <span className="flex gap-2">
                {open && <Link href={`/jobs/${jobId}`} prefetch={false} className={solid}>{t('dash.apply')}</Link>}
                <button type="button" aria-label={t('dash.removeSaved').replace('{title}', job.title)} onClick={() => remove(jobId)} className={outline}>{t('dash.remove')}</button>
              </span>
            </article>
          );
        })
      )}
    </>
  );
}
