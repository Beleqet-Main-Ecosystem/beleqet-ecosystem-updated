'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, CreditCard, FileCheck2, LayoutGrid, ListChecks, MessageSquare, Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { daysUntil } from '@/features/jobs/format';
import { apiGet, apiSend } from './api';
import VerifyEmailBanner from './VerifyEmailBanner';
import ApplicantsSection from './sections/ApplicantsSection';
import CompanySection from './sections/CompanySection';
import PlanSection from './sections/PlanSection';
import TwoStep from './sections/TwoStep';
import { card, Confirm, Empty, Failed, Heading, muted, outline, shortDate, solid } from './ui';

export type EmployerJob = {
  id: string;
  title: string;
  location: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  deadline: string | null;
  _count?: { applications: number };
};

const NAV: { id: string; icon: LucideIcon; href?: string }[] = [
  { id: 'overview', icon: LayoutGrid },
  { id: 'jobs', icon: ListChecks },
  { id: 'applicants', icon: FileCheck2 },
  { id: 'messages', icon: MessageSquare, href: '/messages' },
  { id: 'company', icon: Building2 },
  { id: 'plan', icon: CreditCard },
  { id: 'settings', icon: Settings },
];
const FILTERS = ['all', 'PUBLISHED', 'DRAFT', 'CLOSED'] as const;

export default function EmployerDashboard() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [jobs, setJobs] = useState<EmployerJob[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [closing, setClosing] = useState<EmployerJob | null>(null);
  const [error, setError] = useState('');

  const allowed = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';

  const load = useCallback(() => {
    setFailed(false);
    apiGet<EmployerJob[]>('/jobs/my').then(setJobs).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent('/employer')}`);
    else if (!allowed) router.replace('/dashboard');
    else load();
  }, [ready, user, allowed, router, load]);

  if (!ready || !user || !allowed) return <div className="min-h-[60vh]" />;

  const requested = params.get('tab') ?? 'overview';
  const tab = NAV.some((item) => item.id === requested && !item.href) ? requested : 'overview';
  const selectedJob = params.get('job');
  const list = (jobs ?? []).filter((job) => job.status !== 'ARCHIVED');
  const open = list.filter((job) => job.status === 'PUBLISHED');
  const applicants = (job: EmployerJob) => job._count?.applications ?? 0;
  const closes = (job: EmployerJob) => (job.deadline ? shortDate(job.deadline, locale) : '—');

  async function setStatus(job: EmployerJob, status: EmployerJob['status'], filled?: boolean) {
    setError('');
    try {
      await apiSend('PATCH', `/jobs/${job.id}`, filled === undefined ? { status } : { status, filled });
      setJobs((rows) => (rows ?? []).map((row) => (row.id === job.id ? { ...row, status } : row)));
    } catch {
      setError(t('freelance.gig.actionFailed'));
    }
  }

  const review = (job: EmployerJob) => (
    <Link href={`/employer?tab=applicants&job=${job.id}`} prefetch={false} className={outline}>{t('emp.review')}</Link>
  );

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-14 pt-4 md:flex-row md:gap-8 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
      <nav aria-label={t('dash.nav')} className="-mx-4 shrink-0 overflow-x-auto px-4 md:mx-0 md:w-[220px] md:overflow-visible md:px-0">
        <ul className="flex gap-1.5 md:sticky md:top-[88px] md:flex-col">
          {NAV.map(({ id, icon: Icon, href }) => {
            const active = tab === id && !href;
            return (
              <li key={id} className="shrink-0">
                <Link
                  href={href ?? `/employer?tab=${id}`}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${active ? 'bg-obsidian text-white dark:bg-limeAccent dark:text-obsidian' : 'text-ink-700 hover:bg-[#EEF1EC] dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {t(`emp.tabs.${id}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <VerifyEmailBanner />
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {failed && <Failed onRetry={load} />}

        {!failed && tab === 'overview' && jobs && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Heading title={t('emp.overview')} sub={t('emp.overviewSub').replace('{open}', String(open.length)).replace('{applicants}', String(open.reduce((sum, job) => sum + applicants(job), 0)))} />
              <Link href="/post-job" className={solid}>+ {t('postJob.title')}</Link>
            </div>
            {open.length === 0 ? (
              <Empty title={t('emp.noOpen')} text={t('emp.noOpenText')}>
                <Link href="/post-job" className={`${solid} mt-2`}>{t('postJob.title')}</Link>
              </Empty>
            ) : (
              <section aria-labelledby="open-h" className={`${card} flex flex-col gap-1`}>
                <div className="flex items-center justify-between gap-3 pb-2">
                  <h2 id="open-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('emp.openJobs')}</h2>
                  <Link href="/employer?tab=jobs" prefetch={false} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('emp.manageAll')} →</Link>
                </div>
                {open.map((job) => (
                  <div key={job.id} className="flex flex-wrap items-center gap-3 border-t border-[#F1F4F6] py-3 dark:border-slate-800">
                    <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <b className="text-ink-900 dark:text-white">{job.title}</b>
                      <span className={muted}>{job.location}</span>
                    </span>
                    <span className="text-sm text-ink-700 dark:text-slate-300">{t('emp.applicantCount').replace('{count}', String(applicants(job)))}</span>
                    <span className={muted}>{closes(job)}</span>
                    {review(job)}
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {!failed && tab === 'jobs' && jobs && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Heading title={t('emp.tabs.jobs')} />
              <Link href="/post-job" className={solid}>+ {t('postJob.title')}</Link>
            </div>
            <div role="group" className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                  className={`min-h-10 rounded-full border px-3.5 text-sm ${filter === item ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                >
                  {t(`emp.filters.${item}`)} ({item === 'all' ? list.length : list.filter((job) => job.status === item).length})
                </button>
              ))}
            </div>
            {list.filter((job) => filter === 'all' || job.status === filter).length === 0 ? (
              <Empty title={t('emp.noJobs')} />
            ) : (
              list.filter((job) => filter === 'all' || job.status === filter).map((job) => {
                const left = daysUntil(job.deadline);
                return (
                  <article key={job.id} className={`${card} flex flex-wrap items-center gap-3`}>
                    <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                      <Link href={`/jobs/${job.id}`} prefetch={false} className="font-bold text-ink-900 hover:underline dark:text-white">{job.title}</Link>
                      <span className={muted}>{[job.location, t('emp.applicantCount').replace('{count}', String(applicants(job))), t('emp.closes').replace('{date}', closes(job))].join(' · ')}</span>
                      {left !== null && left < 0 && job.status === 'PUBLISHED' && <span className="text-[13px] font-semibold text-[#9B2C2C] dark:text-red-300">{t('emp.pastDeadline')}</span>}
                    </span>
                    <span className="rounded-md bg-[#F1F4F6] px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{t(`emp.filters.${job.status}`)}</span>
                    <span className="flex flex-wrap gap-2">
                      {applicants(job) > 0 && review(job)}
                      <Link href={`/post-job?edit=${job.id}`} prefetch={false} className={outline}>{t('emp.edit')}</Link>
                      {job.status === 'PUBLISHED' && <button type="button" onClick={() => setClosing(job)} className={outline}>{t('emp.close')}</button>}
                      {job.status === 'DRAFT' && <button type="button" onClick={() => setStatus(job, 'PUBLISHED')} className={solid}>{t('emp.publish')}</button>}
                      {job.status === 'CLOSED' && <button type="button" onClick={() => setStatus(job, 'PUBLISHED')} className={outline}>{t('emp.reopen')}</button>}
                    </span>
                  </article>
                );
              })
            )}
          </>
        )}

        {!failed && tab === 'applicants' && jobs && <ApplicantsSection jobs={list} selectedId={selectedJob} />}
        {tab === 'company' && <CompanySection openJobs={open.length} />}
        {tab === 'plan' && <PlanSection />}
        {tab === 'settings' && (
          <>
            <Heading title={t('emp.tabs.settings')} />
            <TwoStep />
          </>
        )}
      </div>

      {closing && (
        <Confirm
          title={t('emp.closeTitle')}
          text={t('emp.closeText')}
          cancel={t('emp.closeNotHired')}
          confirm={t('emp.closeHired')}
          onCancel={() => {
            void setStatus(closing, 'CLOSED', false);
            setClosing(null);
          }}
          onConfirm={() => {
            void setStatus(closing, 'CLOSED', true);
            setClosing(null);
          }}
        />
      )}
    </div>
  );
}
