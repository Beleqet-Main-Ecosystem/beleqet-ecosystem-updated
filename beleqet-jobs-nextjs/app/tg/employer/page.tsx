'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '@/features/dashboard/api';
import { shortDate } from '@/features/dashboard/ui';
import MainAction from '@/features/miniapp/MainAction';
import { Band, CompanyMark, card, muted, outlineButton } from '@/features/miniapp/ui';

type EmployerJob = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED' | 'REJECTED';
  location?: string | null;
  createdAt: string;
  reviewNote?: string | null;
  _count?: { applications?: number };
};
type Quota = { plan: string; used: number; max: number | null };
type Company = { name: string; logoUrl?: string | null } | null;

const PILL: Record<string, string> = {
  PUBLISHED: 'bg-mini-lime text-mini-onLime',
  PENDING_REVIEW: 'bg-[#FFF4DE] text-[#7A4B00] dark:bg-[#2E2615] dark:text-[#F2C26B]',
  REJECTED: 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-[#3A1A1A] dark:text-[#F5B4B4]',
  DRAFT: 'bg-ink-100 text-ink-700 dark:bg-mini-dborder dark:text-mini-dtext',
  CLOSED: 'bg-ink-100 text-ink-700 dark:bg-mini-dborder dark:text-mini-dtext',
};

/** An employer's home in the Mini App: what's live, what waits for review, and who applied. */
export default function MiniAppEmployer() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<EmployerJob[] | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [company, setCompany] = useState<Company>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready && user && user.role !== 'EMPLOYER' && user.role !== 'ADMIN') router.replace('/tg');
  }, [ready, user, router]);

  const load = useCallback(() => {
    setFailed(false);
    apiGet<EmployerJob[]>('/jobs/my')
      .then((rows) => setJobs((rows ?? []).filter((job) => job.status !== 'ARCHIVED')))
      .catch(() => setFailed(true));
    apiGet<Quota>('/jobs/my/quota').then(setQuota).catch(() => setQuota(null));
    apiGet<Company>('/users/company').then(setCompany).catch(() => setCompany(null));
  }, []);
  useEffect(() => {
    if (ready && user) load();
  }, [ready, user, load]);

  if (ready && !user) return <p className={`${muted} p-6 text-center`}>{t('mini.apps.signedOut')}</p>;

  const count = (status: EmployerJob['status']) => jobs?.filter((job) => job.status === status).length ?? 0;
  const applicants = jobs?.reduce((sum, job) => sum + (job._count?.applications ?? 0), 0) ?? 0;
  const stats = [
    { n: count('PUBLISHED'), label: t('mini.employer.live'), lime: true },
    { n: count('PENDING_REVIEW'), label: t('mini.employer.inReview') },
    { n: applicants, label: t('mini.employer.applicants') },
  ];

  return (
    <>
      <Band>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <CompanyMark name={company?.name ?? user?.firstName ?? ''} logo={company?.logoUrl} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <b className="truncate font-display text-lg font-bold tracking-[-0.02em]">{company?.name ?? t('mini.employer.title')}</b>
              {quota && (
                <span className="text-[13px] text-white/70">
                  {quota.max === null
                    ? t('mini.employer.planUnlimited').replace('{plan}', quota.plan)
                    : t('mini.employer.planUsed').replace('{plan}', quota.plan).replace('{used}', String(quota.used)).replace('{max}', String(quota.max))}
                </span>
              )}
            </span>
            <Link href="/tg/profile" aria-label={t('mini.tabs.profile')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5 rounded-xl bg-mini-button p-2.5">
                <b className={`text-[22px] tabular-nums ${stat.lime ? 'text-mini-lime' : 'text-white'}`}>{jobs ? stat.n : '–'}</b>
                <span className="text-xs text-white/75">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Band>

      <main className="flex flex-1 flex-col gap-2.5 p-4">
        <h1 className="text-[17px] font-extrabold">{t('mini.employer.yourJobs')}</h1>
        {failed && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <p className={muted}>{t('mini.employer.failed')}</p>
            <button type="button" onClick={load} className={outlineButton}>{t('mini.retry')}</button>
          </div>
        )}
        {!failed && jobs === null && <div className="min-h-[30vh]" aria-busy="true" />}
        {jobs?.length === 0 && <p className={`${card} p-5 text-center ${muted}`}>{t('mini.employer.none')}</p>}
        {jobs?.map((job) => {
          const live = job.status === 'PUBLISHED' || job.status === 'CLOSED';
          const applied = job._count?.applications ?? 0;
          const line =
            job.status === 'PENDING_REVIEW'
              ? t('mini.employer.reviewLine')
              : job.status === 'REJECTED'
                ? job.reviewNote || t('mini.employer.rejectedLine')
                : job.status === 'DRAFT'
                  ? t('mini.employer.draftLine')
                  : t('mini.employer.applicantsLine').replace('{count}', String(applied));
          return (
            <Link key={job.id} href={live ? `/tg/employer/jobs/${job.id}` : `/tg/post-job?edit=${job.id}`} className={`${card} flex flex-col gap-2 p-3.5`}>
              <span className="flex items-start gap-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[15px] text-ink-900 dark:text-white">{job.title}</b>
                  <span className={muted}>{[job.location, shortDate(job.createdAt, locale)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${PILL[job.status] ?? PILL.DRAFT}`}>{t(`mini.employer.status.${job.status}`)}</span>
              </span>
              <span className={`text-[13px] font-semibold leading-snug ${job.status === 'REJECTED' ? 'text-[#9B2C2C] dark:text-[#F5B4B4]' : job.status === 'PUBLISHED' ? 'text-mini-tag dark:text-mini-lime' : 'text-mini-muted dark:text-mini-dmuted'}`}>{line}</span>
            </Link>
          );
        })}
      </main>

      <MainAction text={t('mini.employer.post')} href="/tg/post-job" />
    </>
  );
}
