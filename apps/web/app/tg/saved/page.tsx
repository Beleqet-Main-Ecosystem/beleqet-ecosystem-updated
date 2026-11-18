'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend } from '@/features/dashboard/api';
import { daysUntil } from '@/features/jobs/format';
import { CompanyMark, TabBar, card, heading, muted, outlineButton } from '@/features/miniapp/ui';

type Saved = {
  jobId: string;
  job: {
    title: string;
    location?: string;
    deadline?: string | null;
    status?: string;
    company?: { name?: string; logoUrl?: string | null } | null;
  };
};

/** Jobs a job seeker saved with the bookmark on a job, soonest deadline first. */
export default function MiniAppSaved() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Saved[]>('/users/saved-jobs')
      .then((rows) => setSaved([...(rows ?? [])].sort((a, b) => (a.job.deadline ?? '9').localeCompare(b.job.deadline ?? '9'))))
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (ready && user) load();
  }, [ready, user, load]);

  async function remove(jobId: string) {
    setError('');
    try {
      await apiSend('DELETE', `/users/saved-jobs/${jobId}`);
      setSaved((list) => (list ?? []).filter((item) => item.jobId !== jobId));
    } catch {
      setError(t('mini.saved.removeFailed'));
    }
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h1 className={heading}>{t('mini.saved.title')}</h1>
          {saved && saved.length > 0 && <p className={muted}>{t('mini.saved.sub').replace('{count}', String(saved.length))}</p>}
        </div>

        {ready && !user && <p className={muted}>{t('mini.saved.signedOut')}</p>}
        {failed && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <p className={muted}>{t('mini.saved.failed')}</p>
            <button type="button" onClick={load} className={outlineButton}>{t('mini.retry')}</button>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {user && !failed && saved === null && <div className="min-h-[40vh]" aria-busy="true" />}
        {saved?.length === 0 && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <Bookmark className="h-8 w-8 text-mini-tag dark:text-mini-lime" aria-hidden="true" />
            <b className="text-[15px]">{t('mini.saved.none')}</b>
            <p className={muted}>{t('mini.saved.noneText')}</p>
            <Link href="/tg" className={outlineButton}>{t('mini.apps.findJobs')}</Link>
          </div>
        )}

        {saved?.map(({ jobId, job }) => {
          const left = daysUntil(job.deadline);
          const closed = job.status === 'CLOSED' || job.status === 'ARCHIVED' || (left !== null && left < 0);
          const company = job.company?.name ?? '';
          return (
            <article key={jobId} className={`${card} flex items-center gap-3 p-3.5`}>
              <Link href={`/tg/jobs/${jobId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <CompanyMark name={company || job.title} logo={job.company?.logoUrl} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[15px] text-ink-900 dark:text-white">{job.title}</b>
                  <span className={muted}>{[company, job.location].filter(Boolean).join(' · ')}</span>
                  {closed ? (
                    <span className="text-xs font-bold text-[#9B2C2C] dark:text-[#F5B4B4]">{t('mini.saved.closed')}</span>
                  ) : (
                    left !== null && <span className="text-xs font-bold text-[#7A4B00] dark:text-[#F2C26B]">{t('mini.job.closesIn').replace('{days}', String(left))}</span>
                  )}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void remove(jobId)}
                aria-label={t('mini.saved.removeLabel').replace('{title}', job.title)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mini-tag dark:text-mini-lime"
              >
                <Bookmark className="h-5 w-5 fill-current" aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </main>
      {user && <TabBar />}
    </>
  );
}
