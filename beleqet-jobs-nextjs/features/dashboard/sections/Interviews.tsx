'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { fetchApplications, type Application } from '../api';
import { card, Empty, Failed, Heading, muted, outline } from '../ui';

/** There is no candidate interview list yet, so this reads the slot saved on each application. */
export default function Interviews() {
  const { t, locale } = useTranslation();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchApplications().then(setApps).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!apps) return <div className="min-h-[40vh]" />;

  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const interviews = apps.filter((app) => app.interviewSlot).sort((a, b) => b.interviewSlot!.localeCompare(a.interviewSlot!));

  return (
    <>
      <Heading title={t('dash.tabs.interviews')} sub={t('dash.interviewsSub')} />
      {interviews.length === 0 ? (
        <Empty title={t('dash.noInterviews')} text={t('dash.noInterviewsText')} />
      ) : (
        interviews.map((app) => (
          <article key={app.id} className={`${card} flex flex-wrap items-center gap-3`}>
            <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
              <b className="text-ink-900 dark:text-white">{app.job.title}</b>
              <span className={muted}>{[app.job.company?.name, app.job.location].filter(Boolean).join(' · ')}</span>
              <span className="text-sm font-semibold text-ink-900 dark:text-white">{when(app.interviewSlot!)}</span>
            </span>
            <Link href="/messages" className={outline}>{t('dash.messageEmployer')}</Link>
          </article>
        ))
      )}
    </>
  );
}
