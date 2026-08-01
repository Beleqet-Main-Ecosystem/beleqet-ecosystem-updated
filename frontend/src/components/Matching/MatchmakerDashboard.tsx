'use client';

import { useState } from 'react';
import { usePolling } from '@/hooks/usePolling';
import { getJobMatches } from '@/lib/api';
import { useMatchingTranslation } from '@/i18n/use-matching-translation';
import { ScoreRing, SubScoreBar } from './ScoreRing';
import type { MatchResult } from '@/types';

interface MatchmakerDashboardProps {
  jobId: string;
  jobTitle: string;
}

/**
 * AI Matchmaker dashboard: ranked freelancers for a given FreelanceJob,
 * with an adjustable minimum-score threshold.
 */
export function MatchmakerDashboard({ jobId, jobTitle }: MatchmakerDashboardProps) {
  const { t } = useMatchingTranslation();
  const [minScore, setMinScore] = useState(50);

  const {
    data: matches,
    loading,
    error,
    refetch,
  } = usePolling<MatchResult[]>(() => getJobMatches(jobId, minScore, 20), 30_000);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('matching.title')}</p>
          <h1 className="text-xl font-semibold text-slate-900">{jobTitle}</h1>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {t('matching.rescore')}
        </button>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <label htmlFor="minScore" className="text-sm font-medium text-slate-600">
          {t('matching.minScoreLabel')}
        </label>
        <input
          id="minScore"
          type="range"
          min={0}
          max={100}
          step={5}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-700">{minScore}%</span>
      </div>

      {loading && <MatchListSkeleton />}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('matching.loadError')}: {error}.{' '}
          <button type="button" onClick={refetch} className="font-medium underline underline-offset-2">
            {t('matching.tryAgain')}
          </button>
        </div>
      )}

      {!loading && !error && matches && matches.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {t('matching.noMatches', { minScore })}
        </div>
      )}

      {!loading && !error && matches && matches.length > 0 && (
        <ul className="space-y-2">
          {matches.map((match, index) => (
            <MatchRow key={match.userId} match={match} rank={index + 1} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchRow({
  match,
  rank,
  t,
}: {
  match: MatchResult;
  rank: number;
  t: (key: Parameters<ReturnType<typeof useMatchingTranslation>['t']>[0]) => string;
}) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-300">{rank}</span>

      {match.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar source is a stored user upload URL, not a local asset
        <img src={match.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-500">
          {match.firstName[0]}
          {match.lastName[0]}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {match.firstName} {match.lastName}
        </p>
        {match.headline && <p className="truncate text-xs text-slate-500">{match.headline}</p>}
        <div className="mt-2 space-y-1">
          <SubScoreBar label={t('matching.skills')} score={match.skillScore} />
          <SubScoreBar label={t('matching.location')} score={match.locationScore} />
          <SubScoreBar label={t('matching.experience')} score={match.experienceScore} />
        </div>
      </div>

      <ScoreRing score={match.overallScore} />
    </li>
  );
}

function MatchListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-6 w-6 shrink-0 rounded bg-slate-100" />
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            <div className="h-2 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}