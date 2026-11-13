'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import type { Job } from '@/lib/api';
import { apiGet } from '@/features/dashboard/api';
import { daysUntil, formatSalary, jobGender, postedAgo, safeHttpUrl } from '@/features/jobs/format';
import { parseDescription, type DescriptionBlock } from '@/features/jobs/description';
import { useTelegram } from '@/hooks/useTelegram';
import { botRegistrationUrl, openInTelegram } from '@/lib/telegram-login';
import { fetchMiniAppJob } from '@/features/miniapp/data';
import MainAction from '@/features/miniapp/MainAction';
import { Band, CompanyMark, card, muted } from '@/features/miniapp/ui';

export default function MiniAppJob() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const { webApp } = useTelegram();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    setFailed(false);
    fetchMiniAppJob(id).then(setJob).catch(() => setFailed(true));
  }, [id]);

  useEffect(() => {
    if (!user) return;
    apiGet<Array<{ jobId: string }>>('/applications/my')
      .then((rows) => setApplied((rows ?? []).some((row) => row.jobId === id)))
      .catch(() => undefined);
  }, [user, id]);

  const blocks = useMemo<DescriptionBlock[]>(
    () => (job ? [...parseDescription(job.description), ...parseDescription(job.requirements)] : []),
    [job],
  );

  if (failed) return <p className={`${muted} p-6 text-center`}>{t('mini.job.failed')}</p>;
  if (job === undefined) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (job === null) {
    return (
      <main className="flex flex-col items-center gap-2 p-8 text-center">
        <b className="text-[17px]">{t('mini.job.goneTitle')}</b>
        <p className={muted}>{t('mini.job.goneText')}</p>
      </main>
    );
  }

  const gender = jobGender(job.gender);
  const days = daysUntil(job.closesAt);
  const closed = days !== null && days < 0;
  const facts = [
    { k: t('mini.job.salary'), v: formatSalary(job, t('search.upTo')) ?? t('mini.salaryNotListed') },
    { k: t('mini.job.type'), v: job.typeCode ? t(`search.types.${job.typeCode}`) : job.type },
    job.experienceLevel ? { k: t('mini.job.experience'), v: job.experienceLevel } : null,
    job.vacancies ? { k: t('mini.job.openings'), v: String(job.vacancies) } : null,
    { k: t('mini.job.gender'), v: t(`postJob.genders.${gender ?? 'ANY'}`) },
    job.categoryLabel ? { k: t('mini.job.category'), v: job.categoryLabel } : null,
  ].filter((fact): fact is { k: string; v: string } => fact !== null);
  const shown = full ? blocks : blocks.slice(0, 3);

  // What the bottom button does depends on who is looking and how this job takes applications.
  const external = job.applyMethod === 'external' ? safeHttpUrl(job.applyUrl) : null;
  let action: { text: string; href?: string; onClick?: () => void; disabled?: boolean };
  if (closed) action = { text: t('mini.job.closed'), disabled: true };
  else if (external) action = { text: t('mini.job.applyExternal'), onClick: () => (webApp?.openLink ? webApp.openLink(external) : window.open(external, '_blank', 'noopener')) };
  else if (ready && !user) action = { text: t('mini.job.registerToApply'), onClick: () => openInTelegram(botRegistrationUrl(`/jobs/${job.id}`)) };
  else if (applied) action = { text: t('mini.job.appliedTrack'), href: '/tg/applications' };
  else if (user?.role === 'EMPLOYER') action = { text: t('mini.job.employersCantApply'), disabled: true };
  else action = { text: t('mini.job.apply'), href: `/tg/jobs/${job.id}/apply` };

  return (
    <>
      <Band>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <CompanyMark name={job.company} logo={job.companyLogo} size={52} />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm text-white/85">{job.company}</span>
              {job.companyVerified && (
                <span className="inline-flex items-center gap-1 self-start rounded-full bg-mini-lime/15 px-2 py-0.5 text-xs font-bold text-mini-lime">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('mini.job.verified')}
                </span>
              )}
            </span>
          </div>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.03em]">{job.title}</h1>
          <p className="text-sm text-white/70">
            {[job.location, postedAgo(job.createdAt, locale, job.postedAgo), job.applicantCount ? t('mini.job.applicants').replace('{count}', String(job.applicantCount)) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Band>

      <main className="flex flex-1 flex-col gap-3 p-4">
        <dl className="grid grid-cols-2 gap-2">
          {facts.map((fact) => (
            <div key={fact.k} className={`${card} flex flex-col gap-0.5 p-3`}>
              <dt className="text-xs text-mini-muted dark:text-slate-400">{fact.k}</dt>
              <dd className="text-sm font-bold leading-snug text-ink-900 dark:text-white">{fact.v}</dd>
            </div>
          ))}
        </dl>

        {days !== null && !closed && (
          <p className="rounded-xl bg-[#FFF4DE] px-3.5 py-2.5 text-sm font-semibold text-[#7A4B00] dark:bg-[#2E2615] dark:text-[#F2C26B]">
            {t('mini.job.closesIn').replace('{days}', String(days))}
          </p>
        )}

        {blocks.length > 0 && (
          <section aria-labelledby="about-job" className={`${card} flex flex-col gap-2 p-4`}>
            <h2 id="about-job" className="text-base font-extrabold text-ink-900 dark:text-white">{t('mini.job.about')}</h2>
            <div className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">
              {shown.map((block, i) =>
                block.kind === 'heading' ? (
                  <h3 key={i} className="mt-1 font-bold text-ink-900 dark:text-white">{block.text}</h3>
                ) : block.kind === 'list' ? (
                  <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">
                    {block.items.map((item, j) => <li key={j}>{item}</li>)}
                  </ul>
                ) : (
                  <p key={i}>{block.text}</p>
                ),
              )}
            </div>
            {blocks.length > 3 && (
              <button type="button" onClick={() => setFull(!full)} className="self-start py-2 text-sm font-bold text-mini-tag dark:text-mini-lime">
                {t(full ? 'mini.job.less' : 'mini.job.more')}
              </button>
            )}
          </section>
        )}
        <p className={`${muted} px-1`}>{t('mini.job.safety')}</p>
      </main>

      <MainAction {...action} />
    </>
  );
}
