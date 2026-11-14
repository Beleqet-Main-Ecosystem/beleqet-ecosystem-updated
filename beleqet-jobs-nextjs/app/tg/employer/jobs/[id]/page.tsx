'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Phone, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { errorText } from '@/lib/api-error';
import { apiGet, apiSend, type ApplicationStatus } from '@/features/dashboard/api';
import { shortDate } from '@/features/dashboard/ui';
import { safeHttpUrl } from '@/features/jobs/format';
import { useTelegram } from '@/hooks/useTelegram';
import { CompanyMark, card, chipOff, chipOn, heading, muted, outlineButton } from '@/features/miniapp/ui';

type Applicant = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  resumeUrl?: string | null;
  coverLetter?: string | null;
  score?: { overallScore: number } | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
    telegramUsername?: string | null;
    city?: string | null;
    gender?: 'MALE' | 'FEMALE' | null;
  };
};

const STAGES: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'];
const VIEWS = ['all', 'SUBMITTED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'] as const;

/** Who applied to one job, best matches first, with a way to call, message and move each one. */
export default function MiniAppApplicants() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const { webApp } = useTelegram();
  const [rows, setRows] = useState<Applicant[] | null>(null);
  const [title, setTitle] = useState('');
  const [view, setView] = useState<(typeof VIEWS)[number]>('all');
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Applicant[]>(`/applications/job/${id}`).then((list) => setRows(list ?? [])).catch(() => setFailed(true));
    apiGet<{ title: string }>(`/jobs/${id}`).then((job) => setTitle(job?.title ?? '')).catch(() => undefined);
  }, [id]);
  useEffect(() => {
    if (ready && user) load();
  }, [ready, user, load]);

  const shown = useMemo(() => (rows ?? []).filter((row) => view === 'all' || row.status === view), [rows, view]);

  async function move(applicationId: string, status: ApplicationStatus) {
    setError('');
    const before = rows;
    setRows((current) => current?.map((row) => (row.id === applicationId ? { ...row, status } : row)) ?? null);
    try {
      await apiSend('PATCH', `/applications/${applicationId}/status`, { status });
    } catch (problem) {
      setRows(before);
      setError(errorText(problem, t, 'mini.applicants.moveFailed'));
    }
  }

  function message(username: string) {
    const link = `https://t.me/${username}`;
    if (webApp?.openTelegramLink) webApp.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener');
  }

  const counts = (status: string) => (status === 'all' ? rows?.length ?? 0 : rows?.filter((row) => row.status === status).length ?? 0);

  return (
    <main className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h1 className={heading}>{title || t('mini.applicants.title')}</h1>
        {rows && <p className={muted}>{t('mini.applicants.sub').replace('{count}', String(rows.length))}</p>}
      </div>
      <div role="group" aria-label={t('mini.applicants.show')} className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {VIEWS.map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={view === v ? chipOn : chipOff}>
            {(v === 'all' ? t('mini.feed.all') : t(`dash.status.${v}`)) + ` ${counts(v)}`}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {failed && (
        <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
          <p className={muted}>{t('mini.applicants.failed')}</p>
          <button type="button" onClick={load} className={outlineButton}>{t('mini.retry')}</button>
        </div>
      )}
      {!failed && rows === null && <div className="min-h-[40vh]" aria-busy="true" />}
      {rows && shown.length === 0 && <p className={`${card} p-5 text-center ${muted}`}>{t('mini.applicants.none')}</p>}

      {shown.map((row) => {
        const name = `${row.user.firstName} ${row.user.lastName}`.trim();
        const cv = safeHttpUrl(row.resumeUrl);
        const phone = row.user.phone?.replace(/[^+\d]/g, '');
        const about = [
          row.user.city,
          row.user.gender ? t(`postJob.genders.${row.user.gender}`) : null,
          t('mini.apps.applied').replace('{date}', shortDate(row.createdAt, locale)),
        ].filter(Boolean).join(' · ');
        return (
          <article key={row.id} className={`${card} flex flex-col gap-2.5 p-3.5`}>
            <div className="flex items-start gap-3">
              <CompanyMark name={name} size={42} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <b className="text-[15px] text-ink-900 dark:text-white">{name}</b>
                <span className={muted}>{about}</span>
                {row.user.email && <span className={`${muted} break-all`}>{row.user.email}</span>}
              </span>
              {row.score && (
                <span className="shrink-0 rounded-md bg-mini-button px-2 py-0.5 text-xs font-extrabold tabular-nums text-mini-lime">
                  {t('mini.applicants.match').replace('{score}', String(Math.round(row.score.overallScore)))}
                </span>
              )}
            </div>
            {row.coverLetter && <p className="line-clamp-3 text-sm leading-relaxed text-ink-700 dark:text-mini-dsoft">{row.coverLetter}</p>}
            <div className="grid grid-cols-3 gap-1.5">
              {cv ? (
                <a href={cv} target="_blank" rel="noopener noreferrer" className={`${outlineButton} gap-1.5 !px-2`}><FileText className="h-4 w-4" aria-hidden="true" />CV</a>
              ) : (
                <span className={`${outlineButton} !px-2 opacity-50`}>{t('mini.applicants.noCv')}</span>
              )}
              {phone ? (
                <a href={`tel:${phone}`} aria-label={t('mini.applicants.call').replace('{name}', name)} className={`${outlineButton} gap-1.5 !px-2`}><Phone className="h-4 w-4" aria-hidden="true" />{t('mini.applicants.callShort')}</a>
              ) : (
                <span className={`${outlineButton} !px-2 opacity-50`}>{t('mini.applicants.noPhone')}</span>
              )}
              {row.user.telegramUsername ? (
                <button type="button" onClick={() => message(row.user.telegramUsername!)} aria-label={t('mini.applicants.message').replace('{name}', name)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-mini-button px-2 text-sm font-bold text-white">
                  <Send className="h-4 w-4" aria-hidden="true" />Telegram
                </button>
              ) : (
                <span className={`${outlineButton} !px-2 opacity-50`}>{t('mini.applicants.noTelegram')}</span>
              )}
            </div>
            <label className="flex items-center gap-2.5 text-[13px] text-mini-muted dark:text-mini-dmuted">
              {t('mini.applicants.stage')}
              <select
                value={row.status}
                onChange={(e) => void move(row.id, e.target.value as ApplicationStatus)}
                aria-label={t('mini.applicants.stageFor').replace('{name}', name)}
                className="h-10 flex-1 rounded-xl border border-ink-300 bg-white px-2.5 text-sm font-bold text-ink-900 dark:border-mini-dborder dark:bg-mini-dcard dark:text-white"
              >
                {row.status === 'WITHDRAWN' && <option value="WITHDRAWN">{t('dash.status.WITHDRAWN')}</option>}
                {STAGES.map((stage) => <option key={stage} value={stage}>{t(`dash.status.${stage}`)}</option>)}
              </select>
            </label>
          </article>
        );
      })}
    </main>
  );
}
