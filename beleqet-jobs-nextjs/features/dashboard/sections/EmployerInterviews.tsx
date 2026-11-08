'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { safeHttpUrl } from '@/features/jobs/format';
import { apiSend } from '../api';
import { card, Field, input, muted, outline, solid } from '../ui';
import { fetchInterviews, whenText, type Interview } from './Interviews';
import { errorText } from '@/lib/api-error';

/** Upcoming interviews the employer scheduled, with the candidate's answer and where to meet. */
export default function EmployerInterviews() {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<Interview[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ location: '', meetingLink: '', notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchInterviews().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const upcoming = (rows ?? []).filter((row) => row.employerId === user?.id && new Date(row.endTime) > new Date() && row.status !== 'CANCELLED');
  if (upcoming.length === 0) return null;

  async function save(event: FormEvent, row: Interview) {
    event.preventDefault();
    if (draft.meetingLink && !safeHttpUrl(draft.meetingLink)) {
      setError(t('postJob.errUrl'));
      return;
    }
    setError('');
    try {
      const updated = await apiSend<Interview>('PATCH', `/interview-planner/interviews/${row.id}`, draft);
      setRows((list) => list && list.map((item) => (item.id === row.id ? { ...item, location: updated.location, meetingLink: updated.meetingLink, notes: updated.notes } : item)));
      setEditing(null);
    } catch (problem) {
      setError(errorText(problem, t, 'dash.saveFailed'));
    }
  }

  return (
    <section aria-labelledby="int-h" className={`${card} flex flex-col gap-3`}>
      <h2 id="int-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('emp.interviewsTitle')}</h2>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {upcoming.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 border-t border-[#F1F4F6] pt-3 dark:border-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-ink-900 dark:text-white">{row.candidate ? `${row.candidate.firstName} ${row.candidate.lastName}` : ''}</b>
              <span className={muted}>{[row.application.job.title, whenText(row.startTime, locale)].join(' · ')}</span>
              {row.candidateNote && <span className="text-sm text-ink-700 dark:text-slate-300">“{row.candidateNote}”</span>}
            </span>
            <span className="text-xs font-bold text-ink-700 dark:text-slate-300">{t(`dash.interview.status.${row.status}`)}</span>
          </div>
          {editing === row.id ? (
            <form noValidate onSubmit={(event) => save(event, row)} className="flex flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t('dash.interview.where')}><input type="text" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className={input} /></Field>
                <Field label={t('dash.interview.link')}><input type="url" inputMode="url" placeholder="https://" value={draft.meetingLink} onChange={(e) => setDraft({ ...draft, meetingLink: e.target.value })} className={input} /></Field>
              </div>
              <Field label={t('dash.interview.notes')}><textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={`${input} resize-y py-2.5`} /></Field>
              <span className="flex flex-wrap gap-2">
                <button type="submit" className={solid}>{t('postJob.save')}</button>
                <button type="button" onClick={() => setEditing(null)} className={outline}>{t('postJob.cancel')}</button>
              </span>
            </form>
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              <span className={`flex-1 ${muted}`}>{[row.location, safeHttpUrl(row.meetingLink) && t('dash.interview.hasLink')].filter(Boolean).join(' · ') || t('emp.noPlaceYet')}</span>
              <button
                type="button"
                onClick={() => { setEditing(row.id); setDraft({ location: row.location ?? '', meetingLink: row.meetingLink ?? '', notes: row.notes ?? '' }); }}
                className={outline}
              >
                {t('emp.setDetails')}
              </button>
            </span>
          )}
        </div>
      ))}
    </section>
  );
}
