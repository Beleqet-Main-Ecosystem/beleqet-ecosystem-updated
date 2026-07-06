'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import type { Job } from '@/lib/api';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Feed is refreshed automatically at this interval so it keeps reflecting
 *  new searches/saved jobs without requiring a manual reload. */
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Client-side controller for the `/feed` page.
 *
 * Fetches the personalized job feed from `GET /api/v1/ai-feed`, which
 * requires an authenticated request — this component is where the caller's
 * JWT (read from `localStorage` via `authenticatedFetch`) is attached, since
 * the parent `page.tsx` server component has no access to it.
 *
 * Note on GDPR: this component does not manage the user's `gdprConsent`
 * flag itself — that belongs to the Users module's profile settings
 * (`PATCH /users/profile`), which is out of scope for the AI Feed module.
 * If personalization looks generic, the user's consent setting (or lack of
 * search/skill/saved-job history) is the reason, and a link to `/profile`
 * is offered so they can manage it there.
 */
export default function FeedClient() {
  const { user, ready } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Fetches (or re-fetches) the personalized feed for the current user. */
  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`${API_URL}/ai-feed?limit=10`);
      if (!res.ok) {
        throw new Error(`Failed to load feed (status ${res.status})`);
      }
      const data: Job[] = await res.json();
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    loadFeed();
    const interval = setInterval(loadFeed, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, user, loadFeed]);

  if (!ready) {
    return null;
  }

  if (!user) {
    return (
      <p className="text-gray-600">
        Please{' '}
        <Link href="/login" className="text-[#00653B] font-medium underline">
          log in
        </Link>{' '}
        to see your personalized job feed.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Based on your searches, skills, and saved jobs.{' '}
          <Link href="/profile" className="underline">
            Manage privacy settings
          </Link>
        </p>
        <button
          onClick={loadFeed}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium transition disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh recommendations'}
        </button>
      </div>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {loading && jobs.length === 0 ? (
        <p className="text-gray-600">Loading recommendations…</p>
      ) : jobs.length === 0 ? (
        <p className="text-gray-500">No matching jobs found yet.</p>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} showMatchScore />
          ))}
        </div>
      )}
    </div>
  );
}
