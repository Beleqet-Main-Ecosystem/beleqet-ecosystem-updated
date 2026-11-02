'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toDisplayJob, type Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { apiGet, fetchProfile } from '@/features/dashboard/api';
import { card, Empty, Failed, muted, outline, solid } from '@/features/dashboard/ui';
import JobResultCard from '@/features/jobs/components/JobResultCard';

const HIDDEN_KEY = 'beleqet_feed_hidden';

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Personalised feed from GET /ai-feed. It needs the JWT held in the browser, so
 * it loads here rather than on the server. Without consent or enough signal the
 * API falls back to the newest jobs, which this page says plainly.
 */
export default function FeedClient() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [skills, setSkills] = useState<string[] | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setJobs(null);
    apiGet<unknown[]>('/ai-feed?limit=10')
      .then((rows) => setJobs(rows.map(toDisplayJob)))
      .catch(() => setFailed(true));
    fetchProfile().then((profile) => setSkills(profile.skills)).catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    setHidden(readHidden());
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

  function hide(id: string) {
    const next = [...hidden, id];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      // Private window: the job stays hidden until the page reloads.
    }
  }

  const shown = jobs?.filter((job) => !hidden.includes(job.id)) ?? [];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
        {skills?.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F0D9A8] bg-[#FFF7E6] p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
              <b className="text-[15px] text-[#5C3A00] dark:text-amber-100">{t('feed.notEnough')}</b>
              <span className="text-sm text-[#7A4B00] dark:text-amber-200">{t('feed.notEnoughText')}</span>
            </span>
            <Link href="/dashboard?tab=profile" prefetch={false} className={outline}>{t('feed.addSkills')}</Link>
          </div>
        )}
        {jobs === null ? (
          <div className="min-h-[40vh]" />
        ) : shown.length === 0 ? (
          <Empty title={t('feed.seenAll')} text={t('feed.seenAllText')}>
            <Link href="/jobs" className={`${solid} mt-2`}>{t('feed.searchAll')}</Link>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((job) => (
              <div key={job.id} className="flex flex-col gap-1">
                <ul>
                  <JobResultCard job={job} />
                </ul>
                <button
                  type="button"
                  aria-label={t('feed.hideJob').replace('{title}', job.title)}
                  onClick={() => hide(job.id)}
                  className="inline-flex min-h-9 items-center gap-1 self-end px-1 text-[13px] font-semibold text-ink-500 dark:text-slate-400"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('feed.hide')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="flex w-full min-w-0 flex-[1_1_280px] flex-col gap-4 md:max-w-[340px]">
        <section className={`${card} flex flex-col gap-2.5`}>
          <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('feed.matchOn')}</h2>
          <span className={muted}>{t('feed.yourSkills')}</span>
          {skills && skills.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <li key={skill} className="rounded-full bg-[#F1F4F6] px-2.5 py-1 text-xs font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{skill}</li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-ink-700 dark:text-slate-300">{t('feed.noSkills')}</span>
          )}
          <Link href="/dashboard?tab=profile" prefetch={false} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('feed.editSkills')} →</Link>
        </section>
      </aside>
    </div>
  );
}
