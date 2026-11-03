'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toDisplayJob, type Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend } from '@/features/dashboard/api';
import { card, Empty, Failed, muted, outline, solid } from '@/features/dashboard/ui';
import JobResultCard from '@/features/jobs/components/JobResultCard';

type Reason = { kind: 'skills' | 'search'; terms: string[] } | { kind: 'saved' };
type FeedJob = Job & { reasons: Reason[] };
type Signals = { personalised: boolean; skills: string[]; searches: string[] };

/**
 * Personalised feed from GET /ai-feed. It needs the JWT held in the browser, so
 * it loads here rather than on the server. Without consent or enough signal the
 * API falls back to the newest jobs, which this page says plainly.
 */
export default function FeedClient() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const [jobs, setJobs] = useState<FeedJob[] | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    setJobs(null);
    apiGet<Array<Record<string, unknown>>>('/ai-feed?limit=10')
      .then((rows) => setJobs(rows.map((row) => ({ ...toDisplayJob(row), reasons: (row.reasons as Reason[]) ?? [] }))))
      .catch(() => setFailed(true));
    apiGet<Signals>('/ai-feed/signals').then(setSignals).catch(() => setSignals(null));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!ready) return <div className="min-h-[50vh]" />;

  if (!user) {
    return (
      <Empty title={t('feed.signInTitle')} text={t('feed.signInText')}>
        <Link href="/login?next=/feed" className={`${solid} mt-2`}>{t('postJob.signIn')}</Link>
      </Empty>
    );
  }
  if (failed) return <Failed onRetry={load} />;

  // "Not interested" is kept on the server, so it holds on every device.
  async function hide(id: string) {
    const before = jobs;
    setJobs((list) => list && list.filter((job) => job.id !== id));
    setError('');
    try {
      await apiSend('POST', `/ai-feed/hidden/${id}`);
    } catch {
      setJobs(before);
      setError(t('feed.hideFailed'));
    }
  }

  const reasonText = (reason: Reason) =>
    reason.kind === 'saved'
      ? t('feed.reasons.saved')
      : t(`feed.reasons.${reason.kind}`).replace('{terms}', reason.terms.join(', '));
  // Nothing matched on anything: these are simply the newest jobs.
  const fallback = signals !== null && (!signals.personalised || (jobs !== null && jobs.length > 0 && jobs.every((job) => job.reasons.length === 0)));

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {fallback && (
          <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F0D9A8] bg-[#FFF7E6] p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
              <b className="text-[15px] text-[#5C3A00] dark:text-amber-100">{t(signals?.personalised ? 'feed.notEnough' : 'feed.offTitle')}</b>
              <span className="text-sm text-[#7A4B00] dark:text-amber-200">{t(signals?.personalised ? 'feed.notEnoughText' : 'feed.offText')}</span>
            </span>
            <Link href={signals?.personalised ? '/dashboard?tab=profile' : '/dashboard?tab=settings'} prefetch={false} className={outline}>
              {t(signals?.personalised ? 'feed.addSkills' : 'feed.openSettings')}
            </Link>
          </div>
        )}
        {jobs === null ? (
          <div className="min-h-[40vh]" />
        ) : jobs.length === 0 ? (
          <Empty title={t('feed.seenAll')} text={t('feed.seenAllText')}>
            <Link href="/jobs" className={`${solid} mt-2`}>{t('feed.searchAll')}</Link>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-col gap-1.5">
                <ul>
                  <JobResultCard job={job} />
                </ul>
                <div className="flex flex-wrap items-center gap-1.5">
                  {job.reasons.length > 0 && (
                    <ul aria-label={t('feed.why')} className="flex flex-wrap gap-1.5">
                      {job.reasons.map((reason) => (
                        <li key={reason.kind} className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F7EC] px-2.5 py-1 text-[13px] font-semibold text-forest dark:bg-limeAccent/10 dark:text-limeAccent">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          {reasonText(reason)}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    aria-label={t('feed.hideJob').replace('{title}', job.title)}
                    onClick={() => hide(job.id)}
                    className="ml-auto inline-flex min-h-9 items-center gap-1 px-1 text-[13px] font-semibold text-ink-500 dark:text-slate-400"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('feed.hide')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="flex w-full min-w-0 flex-[1_1_280px] flex-col gap-4 md:max-w-[340px]">
        <section className={`${card} flex flex-col gap-2.5`}>
          <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('feed.matchOn')}</h2>
          <span className={muted}>{t('feed.yourSkills')}</span>
          {signals && signals.skills.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {signals.skills.map((skill) => (
                <li key={skill} className="rounded-full bg-[#EEF5EF] px-2.5 py-1 text-xs font-semibold text-forest dark:bg-forest/30 dark:text-limeAccent">{skill}</li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-ink-700 dark:text-slate-300">{t('feed.noSkills')}</span>
          )}
          {signals && signals.searches.length > 0 && (
            <>
              <span className={muted}>{t('feed.recentSearches')}</span>
              <ul className="flex flex-wrap gap-1.5">
                {signals.searches.map((term) => (
                  <li key={term} className="rounded-full bg-[#F1F4F6] px-2.5 py-1 text-xs font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{term}</li>
                ))}
              </ul>
            </>
          )}
          <Link href="/dashboard?tab=profile" prefetch={false} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('feed.editSkills')} →</Link>
        </section>
        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('feed.preferNot')}</h2>
          <span className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('feed.preferNotText')}</span>
          <Link href="/dashboard?tab=settings" prefetch={false} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('feed.openSettings')} →</Link>
        </section>
      </aside>
    </div>
  );
}
