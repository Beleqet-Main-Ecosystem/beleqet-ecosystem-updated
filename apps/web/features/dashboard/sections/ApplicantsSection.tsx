'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { initials, safeHttpUrl } from '@/features/jobs/format';
import { apiGet, apiSend, type ApplicationStatus } from '../api';
import type { EmployerJob } from '../EmployerDashboard';
import { card, Empty, Failed, Heading, input, link, muted, outline, shortDate, solid } from '../ui';
import { errorText } from '@/lib/api-error';

type Applicant = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  coverLetter?: string;
  resumeUrl?: string;
  expectedSalary?: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    /** Null for people who signed up in Telegram without one. */
    email: string | null;
    phone?: string | null;
    telegramUsername?: string | null;
    city?: string | null;
    gender?: 'MALE' | 'FEMALE' | null;
    skills?: string[];
  };
  score?: { overallScore: number; summary?: string };
};

const STAGES: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'];

export default function ApplicantsSection({ jobs, selectedId }: { jobs: EmployerJob[]; selectedId: string | null }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const job = jobs.find((item) => item.id === selectedId) ?? jobs[0];
  const [rows, setRows] = useState<Applicant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const jobId = job?.id;
  const load = useCallback(() => {
    if (!jobId) return;
    setFailed(false);
    setRows(null);
    apiGet<Applicant[]>(`/applications/job/${jobId}`).then(setRows).catch(() => setFailed(true));
  }, [jobId]);
  useEffect(load, [load]);

  if (!job) {
    return (
      <Empty title={t('emp.noJobs')}>
        <Link href="/post-job" className={`${solid} mt-2`}>{t('postJob.title')}</Link>
      </Empty>
    );
  }

  async function move(id: string, status: ApplicationStatus) {
    setError('');
    setNote('');
    try {
      await apiSend('PATCH', `/applications/${id}/status`, { status });
      setRows((list) => (list ?? []).map((row) => (row.id === id ? { ...row, status } : row)));
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    }
  }

  async function schedule(id: string) {
    setError('');
    setNote('');
    try {
      await apiSend('POST', '/interview-planner/auto-schedule', { applicationId: id });
      setNote(t('emp.scheduled'));
      load();
    } catch (problem) {
      setError(errorText(problem, t, 'emp.scheduleFailed'));
    }
  }

  return (
    <>
      <Heading title={t('emp.tabs.applicants')} />
      <label className="flex flex-col gap-1.5 md:max-w-[420px]">
        <span className="text-sm font-bold text-ink-900 dark:text-white">{t('emp.applicantsFor')}</span>
        <select value={job.id} onChange={(event) => router.push(`/employer?tab=applicants&job=${event.target.value}`)} className={input}>
          {jobs.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </label>

      {failed && <Failed onRetry={load} />}
      {rows && (
        <ol aria-label={t('emp.pipeline')} className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {STAGES.map((stage) => (
            <li key={stage} className={`${card} flex flex-col !p-3`}>
              <b className="text-xl text-ink-900 dark:text-white">{rows.filter((row) => row.status === stage).length}</b>
              <span className="truncate text-xs text-ink-500 dark:text-slate-400">{t(`dash.status.${stage}`)}</span>
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {note && <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{note}</p>}

      {rows?.length === 0 && <Empty title={t('emp.noApplicants')} text={t('emp.noApplicantsText')} />}
      {rows?.map((row) => {
        const name = `${row.user.firstName} ${row.user.lastName}`;
        const cv = safeHttpUrl(row.resumeUrl);
        return (
          <article key={row.id} className={`${card} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">{initials(name)}</span>
              <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <b className="text-ink-900 dark:text-white">{name}</b>
                <span className={`break-all ${muted}`}>
                  {[row.user.email, row.user.city, row.user.gender ? t(`postJob.genders.${row.user.gender}`) : null, shortDate(row.createdAt, locale)].filter(Boolean).join(' · ')}
                </span>
                {(row.user.phone || row.user.telegramUsername) && (
                  <span className="flex flex-wrap gap-x-3 text-[13px]">
                    {row.user.phone && <a href={`tel:${row.user.phone.replace(/[^+\d]/g, '')}`} className={link}>{row.user.phone}</a>}
                    {row.user.telegramUsername && (
                      <a href={`https://t.me/${row.user.telegramUsername}`} target="_blank" rel="noopener noreferrer" className={link}>
                        {t('emp.telegramContact').replace('{username}', row.user.telegramUsername)}
                      </a>
                    )}
                  </span>
                )}
                {row.expectedSalary ? <span className={muted}>{t('emp.expects').replace('{amount}', `ETB ${row.expectedSalary.toLocaleString('en-US')}`)}</span> : null}
              </span>
              {row.score && <span className="rounded-md bg-[#EEF5EF] px-2 py-0.5 text-xs font-bold text-forest dark:bg-forest/30 dark:text-limeAccent">{t('emp.match').replace('{score}', String(Math.round(row.score.overallScore)))}</span>}
            </div>
            {row.coverLetter && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-slate-300">{row.coverLetter}</p>}
            <div className="flex flex-wrap items-end gap-2">
              {cv && <a href={cv} target="_blank" rel="noopener noreferrer" className={outline}>CV</a>}
              <Link href={`/messages?to=${row.user.id}`} prefetch={false} className={outline}>{t('emp.message')}</Link>
              {row.status === 'SHORTLISTED' && <button type="button" onClick={() => schedule(row.id)} className={outline}>{t('emp.autoSchedule')}</button>}
              <label className="ml-auto flex min-w-[180px] flex-col gap-1">
                <span className={muted}>{t('emp.stageFor').replace('{name}', name)}</span>
                <select value={row.status} onChange={(event) => move(row.id, event.target.value as ApplicationStatus)} className={input}>
                  {row.status === 'WITHDRAWN' && <option value="WITHDRAWN">{t('dash.status.WITHDRAWN')}</option>}
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>{t(`dash.status.${stage}`)}</option>
                  ))}
                </select>
              </label>
            </div>
          </article>
        );
      })}
      {rows && rows.length > 0 && <p className={muted}>{t('emp.notified')}</p>}
    </>
  );
}
