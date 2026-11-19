'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, UserRound } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { isPlaceholderEmail } from '@/lib/auth';
import { apiGet, fetchProfile, type Profile } from '@/features/dashboard/api';
import { COMPANY_LINKS, companyLink, companyStatus, shortUrl, type Company } from '@/features/dashboard/company';
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

const PILL: Record<string, string> = {
  PUBLISHED: 'bg-mini-lime text-mini-onLime',
  PENDING_REVIEW: 'bg-[#FFF4DE] text-[#7A4B00] dark:bg-[#2E2615] dark:text-[#F2C26B]',
  REJECTED: 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-[#3A1A1A] dark:text-[#F5B4B4]',
  DRAFT: 'bg-ink-100 text-ink-700 dark:bg-mini-dborder dark:text-mini-dtext',
  CLOSED: 'bg-ink-100 text-ink-700 dark:bg-mini-dborder dark:text-mini-dtext',
};
/** The company's verification status, in the same colours as the job statuses. */
const VERIFY_PILL = { VERIFIED: PILL.PUBLISHED, PENDING: PILL.PENDING_REVIEW, REJECTED: PILL.REJECTED, NONE: PILL.DRAFT };

/** An employer's home in the Mini App: what's live, what waits for review, and who applied. */
export default function MiniAppEmployer() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<EmployerJob[] | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [contact, setContact] = useState<Profile | null>(null);
  const [showCompany, setShowCompany] = useState(false);
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
    apiGet<Company | null>('/users/company').then(setCompany).catch(() => setCompany(null));
    fetchProfile().then(setContact).catch(() => setContact(null));
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
        {company && <CompanyDetails company={company} contact={contact} open={showCompany} onToggle={() => setShowCompany(!showCompany)} />}
        <h1 className="mt-1.5 text-[17px] font-extrabold">{t('mini.employer.yourJobs')}</h1>
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

type DetailsProps = { company: Company; contact: Profile | null; open: boolean; onToggle: () => void };

/** Everything on the company profile and how to reach the employer, folded under a summary line. */
function CompanyDetails({ company, contact, open, onToggle }: DetailsProps) {
  const { t } = useTranslation();
  const status = companyStatus(company);
  const summary = [company.industry, company.size, company.location].filter(Boolean).join(' · ');
  const benefits = company.benefits ?? [];
  const notAdded = <span className="font-normal text-mini-muted dark:text-mini-dmuted">{t('emp.notAdded')}</span>;
  const link = (url: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-mini-tag dark:text-mini-lime">{shortUrl(url)}</a>
  );
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('postJob.company.industry'), value: company.industry },
    { label: t('emp.size'), value: company.size },
    { label: t('postJob.company.location'), value: company.location },
    { label: t('emp.founded'), value: company.foundedYear },
    ...COMPANY_LINKS.map(({ key, label }) => {
      const url = companyLink(company, key);
      return { label: t(label), value: url ? link(url) : null };
    }),
    { label: t('emp.contactPerson'), value: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null },
    { label: t('emp.phone'), value: contact?.phone ? <a href={`tel:${contact.phone}`} className="text-mini-tag dark:text-mini-lime">{contact.phone}</a> : null },
    { label: t('emp.email'), value: contact?.email && !isPlaceholderEmail(contact.email) ? contact.email : null },
    { label: t('emp.telegram'), value: contact?.telegramUsername ? `@${contact.telegramUsername}` : null },
  ];

  return (
    <section className={`${card} flex flex-col`}>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-[60px] items-center gap-3 p-3.5 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[15px] text-ink-900 dark:text-white">{t('mini.employer.company')}</b>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${VERIFY_PILL[status]}`}>{t(`emp.verifyStatus.${status}`)}</span>
          </span>
          <span className={`${muted} truncate`}>{summary || t('mini.employer.companyEmpty')}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-mini-muted transition-transform dark:text-mini-dmuted ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-ink-100 px-3.5 pb-3.5 pt-3 dark:border-mini-dborder">
          <div className="flex flex-col gap-1">
            <span className={muted}>{t('postJob.company.description')}</span>
            {company.description ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-mini-dsoft">{company.description}</p> : <p className="text-sm">{notAdded}</p>}
          </div>
          <dl className="flex flex-col">
            {rows.map((row) => (
              <div key={row.label} className="flex min-h-[44px] items-center gap-2.5 border-t border-ink-100 py-2 dark:border-mini-dborder">
                <dt className="w-28 shrink-0 text-[13px] text-mini-muted dark:text-mini-dmuted">{row.label}</dt>
                <dd className="min-w-0 flex-1 break-words text-sm font-semibold">{row.value || notAdded}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1.5">
            <span className={muted}>{t('emp.benefits')}</span>
            {benefits.length ? (
              <span className="flex flex-wrap gap-1.5">
                {benefits.map((benefit) => (
                  <span key={benefit} className="rounded-full bg-mini-lime/20 px-2.5 py-1 text-[13px] font-semibold text-mini-tag dark:text-mini-lime">{benefit}</span>
                ))}
              </span>
            ) : <span className="text-sm">{notAdded}</span>}
          </div>
          <Link href="/tg/employer/company" className={outlineButton}>{t('mini.employer.editCompany')}</Link>
        </div>
      )}
    </section>
  );
}
