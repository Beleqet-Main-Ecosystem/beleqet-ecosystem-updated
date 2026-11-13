'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { fetchApplications, type Application } from '@/features/dashboard/api';
import { shortDate } from '@/features/dashboard/ui';
import { STAGES, stageOf } from '@/features/miniapp/stages';
import { CompanyMark, TabBar, card, heading, muted, outlineButton } from '@/features/miniapp/ui';

/** A job seeker's applications, each with how far it got. Updates also arrive in the bot. */
export default function MiniAppApplications() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchApplications()
      .then((rows) => setApps([...(rows ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    if (ready && user) load();
  }, [ready, user, load]);

  const active = apps?.filter((app) => !stageOf(app.status).ended).length ?? 0;

  return (
    <>
      <main className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h1 className={heading}>{t('mini.apps.title')}</h1>
          {apps && apps.length > 0 && <p className={muted}>{t('mini.apps.sub').replace('{count}', String(active))}</p>}
        </div>

        {ready && !user && <p className={muted}>{t('mini.apps.signedOut')}</p>}
        {failed && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <p className={muted}>{t('mini.apps.failed')}</p>
            <button type="button" onClick={load} className={outlineButton}>{t('mini.retry')}</button>
          </div>
        )}
        {user && !failed && apps === null && <div className="min-h-[40vh]" aria-busy="true" />}
        {apps?.length === 0 && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <b className="text-[15px]">{t('mini.apps.none')}</b>
            <Link href="/tg" className={outlineButton}>{t('mini.apps.findJobs')}</Link>
          </div>
        )}

        {apps?.map((app) => {
          const { reached, ended } = stageOf(app.status);
          const company = app.job.company?.name ?? '';
          const pill = ended
            ? 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-[#3A1A1A] dark:text-[#F5B4B4]'
            : reached >= 2
              ? 'bg-mini-lime text-mini-onLime'
              : 'bg-ink-100 text-ink-700 dark:bg-slate-800 dark:text-slate-200';
          return (
            <article key={app.id} className={`${card} flex flex-col gap-2.5 p-3.5`}>
              <Link href={`/tg/jobs/${app.jobId}`} className="flex items-start gap-3">
                <CompanyMark name={company || app.job.title} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[15px] text-ink-900 dark:text-white">{app.job.title}</b>
                  <span className={muted}>{[company, t('mini.apps.applied').replace('{date}', shortDate(app.createdAt, locale))].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${pill}`}>{t(`dash.status.${app.status}`)}</span>
              </Link>
              <ol aria-label={t('mini.apps.progress')} className="grid grid-cols-4 gap-1">
                {STAGES.map((stage, i) => (
                  <li key={stage} className="flex flex-col gap-1.5">
                    <span aria-hidden="true" className={`h-[5px] rounded-full ${i <= reached ? (ended ? 'bg-ink-400 dark:bg-slate-600' : 'bg-mini-tag dark:bg-mini-lime') : 'bg-ink-200 dark:bg-slate-800'}`} />
                    <span className={`text-[11px] ${i === reached ? 'font-extrabold text-ink-900 dark:text-white' : 'text-mini-muted dark:text-slate-400'}`}>{t(`mini.stages.${stage}`)}</span>
                  </li>
                ))}
              </ol>
              {app.interviewSlot && (
                <p className="rounded-lg bg-mini-lime/15 px-3 py-2 text-[13px] font-semibold text-mini-tag dark:text-mini-lime">
                  {t('mini.apps.interview').replace('{when}', new Date(app.interviewSlot).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}
                </p>
              )}
            </article>
          );
        })}
      </main>
      {user && <TabBar />}
    </>
  );
}
