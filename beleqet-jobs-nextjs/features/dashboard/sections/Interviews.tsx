'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { safeHttpUrl } from '@/features/jobs/format';
import { apiGet, apiSend } from '../api';
import { card, Empty, Failed, Field, Heading, input, muted, outline, solid } from '../ui';

export type Interview = {
  id: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  candidateNote: string | null;
  candidateId: string;
  employerId: string;
  application: { id: string; job: { id: string; title: string; location?: string; company?: { name?: string; userId?: string } | null } };
  candidate?: { id: string; firstName: string; lastName: string };
};

export const fetchInterviews = () => apiGet<Interview[]>('/interview-planner/interviews');

export function whenText(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const BADGE: Record<Interview['status'], string> = {
  SCHEDULED: 'bg-[#FFF7E6] text-[#7A4B00] dark:bg-amber-900/30 dark:text-amber-200',
  RESCHEDULED: 'bg-[#FFF7E6] text-[#7A4B00] dark:bg-amber-900/30 dark:text-amber-200',
  CONFIRMED: 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent',
  DECLINED: 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-red-900/30 dark:text-red-200',
  COMPLETED: 'bg-[#F1F4F6] text-ink-700 dark:bg-slate-800 dark:text-slate-200',
  CANCELLED: 'bg-[#F1F4F6] text-ink-700 dark:bg-slate-800 dark:text-slate-200',
};

/** The candidate's interviews: when, where, the link, the employer's notes, and an answer. */
export default function Interviews() {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<Interview[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    fetchInterviews().then(setRows).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!rows) return <div className="min-h-[40vh]" />;

  const mine = rows.filter((row) => row.candidateId === user?.id);
  const upcoming = (row: Interview) => new Date(row.startTime) > new Date();

  async function respond(row: Interview, response: 'CONFIRMED' | 'DECLINED') {
    setError('');
    try {
      const updated = await apiSend<Interview>('PATCH', `/interview-planner/interviews/${row.id}/respond`, { response, note: note.trim() || undefined });
      setRows((list) => list && list.map((item) => (item.id === row.id ? { ...item, status: updated.status, candidateNote: updated.candidateNote } : item)));
      setDeclining(null);
      setNote('');
    } catch {
      setError(t('dash.interview.answerFailed'));
    }
  }

  return (
    <>
      <Heading title={t('dash.tabs.interviews')} sub={t('dash.interviewsSub')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {mine.length === 0 ? (
        <Empty title={t('dash.noInterviews')} text={t('dash.noInterviewsText')} />
      ) : (
        mine.map((row) => {
          const link = safeHttpUrl(row.meetingLink);
          const canAnswer = upcoming(row) && ['SCHEDULED', 'RESCHEDULED', 'CONFIRMED'].includes(row.status);
          const company = row.application.job.company;
          return (
            <article key={row.id} className={`${card} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                  <b className="text-ink-900 dark:text-white">{row.application.job.title}</b>
                  <span className={muted}>{[company?.name, row.application.job.location].filter(Boolean).join(' · ')}</span>
                  <span className="text-sm font-semibold text-ink-900 dark:text-white">{whenText(row.startTime, locale)}</span>
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${BADGE[row.status]}`}>{t(`dash.interview.status.${row.status}`)}</span>
              </div>
              {(row.location || link || row.notes) && (
                <dl className="grid gap-1.5 text-sm">
                  {row.location && (<div className="flex gap-2"><dt className="font-semibold text-ink-500 dark:text-slate-400">{t('dash.interview.where')}</dt><dd className="text-ink-900 dark:text-white">{row.location}</dd></div>)}
                  {link && (<div className="flex gap-2"><dt className="font-semibold text-ink-500 dark:text-slate-400">{t('dash.interview.link')}</dt><dd><a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-bold text-forest hover:underline dark:text-limeAccent">{link} ↗</a></dd></div>)}
                  {row.notes && (<div className="flex flex-col gap-0.5"><dt className="font-semibold text-ink-500 dark:text-slate-400">{t('dash.interview.notes')}</dt><dd className="whitespace-pre-line text-ink-900 dark:text-slate-200">{row.notes}</dd></div>)}
                </dl>
              )}
              {declining === row.id ? (
                <div className="flex flex-col gap-2">
                  <Field label={t('dash.interview.declineNote')}>
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} resize-y py-2.5`} />
                  </Field>
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => respond(row, 'DECLINED')} className={solid}>{t('dash.interview.sendDecline')}</button>
                    <button type="button" onClick={() => setDeclining(null)} className={outline}>{t('postJob.cancel')}</button>
                  </span>
                </div>
              ) : (
                <span className="flex flex-wrap gap-2">
                  {canAnswer && row.status !== 'CONFIRMED' && <button type="button" onClick={() => respond(row, 'CONFIRMED')} className={solid}>{t('dash.interview.confirm')}</button>}
                  {canAnswer && <button type="button" onClick={() => { setDeclining(row.id); setNote(''); }} className={outline}>{t('dash.interview.decline')}</button>}
                  {company?.userId && (
                    <Link href={`/messages?to=${company.userId}`} prefetch={false} className={outline}>{t('dash.messageEmployer')}</Link>
                  )}
                </span>
              )}
            </article>
          );
        })
      )}
    </>
  );
}
