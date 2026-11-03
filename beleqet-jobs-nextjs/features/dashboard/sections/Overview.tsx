'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toDisplayJob, type Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatSalary, initials } from '@/features/jobs/format';
import { apiGet, fetchApplications, fetchProfile, profileChecks, type Application, type Profile } from '../api';
import { card, Failed, Heading, link, muted, shortDate } from '../ui';

const ACTIVE = ['SUBMITTED', 'SCREENING', 'SHORTLISTED'];

export default function Overview({ firstName }: { firstName: string }) {
  const { t, locale } = useTranslation();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([fetchApplications(), fetchProfile()])
      .then(([applications, me]) => {
        setApps(applications);
        setProfile(me);
      })
      .catch(() => setFailed(true));
    // The top of the personalised feed; a nice-to-have, so the rest of the page works without it.
    apiGet<unknown[]>('/ai-feed?limit=3')
      .then((rows) => setJobs(rows.map(toDisplayJob)))
      .catch(() => setJobs([]));
  }, []);

  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!apps || !profile) return <div className="min-h-[40vh]" />;

  const interview = apps
    .filter((app) => app.status === 'INTERVIEW_SCHEDULED' && app.interviewSlot && new Date(app.interviewSlot) > new Date())
    .sort((a, b) => a.interviewSlot!.localeCompare(b.interviewSlot!))[0];
  const stats = [
    { key: t('dash.statApplied'), value: apps.length },
    { key: t('dash.statActive'), value: apps.filter((app) => ACTIVE.includes(app.status)).length },
    { key: t('dash.statInterviews'), value: apps.filter((app) => app.status === 'INTERVIEW_SCHEDULED').length },
    { key: t('dash.statOffers'), value: apps.filter((app) => app.status === 'OFFERED').length },
  ];
  const checks = profileChecks(profile);
  const strength = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);

  return (
    <>
      <Heading title={t('dash.hello').replace('{name}', firstName)} sub={t('dash.helloSub')} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.key} href="/dashboard?tab=applications" prefetch={false} className={`${card} flex flex-col gap-1 !p-4`}>
            <span className={muted}>{stat.key}</span>
            <b className="text-[26px] tracking-[-0.02em] text-ink-900 dark:text-white">{stat.value}</b>
          </Link>
        ))}
      </div>

      {interview && (
        <section className="flex flex-wrap items-center gap-4 rounded-xl bg-obsidian p-5 text-white">
          <span className="flex flex-[1_1_260px] flex-col gap-1">
            <span className="text-[13px] font-bold text-limeAccent">{t('dash.upcoming')}</span>
            <b className="text-base">{[interview.job.title, interview.job.company?.name].filter(Boolean).join(' · ')}</b>
            <span className="text-sm text-white/75">{shortDate(interview.interviewSlot!, locale)}</span>
          </span>
          <Link href="/dashboard?tab=interviews" prefetch={false} className="text-sm font-bold text-limeAccent hover:underline">{t('dash.viewDetails')} →</Link>
        </section>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="rec-h" className={`${card} flex min-w-0 flex-[2_1_340px] flex-col gap-2`}>
          <div className="flex items-center justify-between gap-3 pb-1">
            <h2 id="rec-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.jobsForYou')}</h2>
            <Link href="/feed" className={`text-sm ${link}`}>{t('dash.openFeed')} →</Link>
          </div>
          {jobs.length === 0 && <p className={muted}>{t('dash.noJobs')}</p>}
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} prefetch={false} className="flex items-center gap-3 border-t border-[#F1F4F6] py-3 dark:border-slate-800">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-limeAccent" aria-hidden="true">{initials(job.company)}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-[15px] text-ink-900 dark:text-white">{job.title}</b>
                <span className={`truncate ${muted}`}>{[job.company, job.location].filter(Boolean).join(' · ')}</span>
              </span>
              <b className="hidden shrink-0 text-sm text-ink-900 md:block dark:text-white">{formatSalary(job, t('search.upTo'))}</b>
            </Link>
          ))}
        </section>

        <section aria-labelledby="prof-h" className={`${card} flex min-w-0 flex-[1_1_260px] flex-col gap-3`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="prof-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.strength')}</h2>
            <b className="text-ink-900 dark:text-white">{strength}%</b>
          </div>
          <div role="progressbar" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={100} aria-label={t('dash.strength')} className="h-2 overflow-hidden rounded-full bg-[#F1F4F6] dark:bg-slate-800">
            <div className="h-2 bg-forest dark:bg-limeAccent" style={{ width: `${strength}%` }} />
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {checks.map((check) => (
              <li key={check.key} className="flex items-center justify-between gap-2 text-ink-700 dark:text-slate-300">
                <span>{check.done ? '✓' : '○'} {t(`dash.checks.${check.key}`)}</span>
                {!check.done && <Link href="/dashboard?tab=profile" prefetch={false} className={link}>{t('dash.add')}</Link>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
