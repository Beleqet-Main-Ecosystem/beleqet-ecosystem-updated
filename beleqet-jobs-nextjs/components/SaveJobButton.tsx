'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

// Shared module-level cache & in-flight promise to prevent N+1 requests when multiple job cards mount simultaneously
let savedJobsCache: Array<{ jobId: string }> | null = null;
let savedJobsPromise: Promise<Array<{ jobId: string }>> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000;

async function fetchSavedJobs(): Promise<Array<{ jobId: string }>> {
  const now = Date.now();
  if (savedJobsCache && now - lastFetchTime < CACHE_TTL_MS) {
    return savedJobsCache;
  }
  if (savedJobsPromise) {
    return savedJobsPromise;
  }

  savedJobsPromise = (async () => {
    try {
      const response = await authenticatedFetch(`${API_URL}/users/saved-jobs`);
      if (!response.ok) return savedJobsCache ?? [];
      const data = (await response.json()) as Array<{ jobId: string }>;
      savedJobsCache = Array.isArray(data) ? data : [];
      lastFetchTime = Date.now();
      return savedJobsCache;
    } catch {
      return savedJobsCache ?? [];
    } finally {
      savedJobsPromise = null;
    }
  })();

  return savedJobsPromise;
}

export default function SaveJobButton({ jobId, light = true }: { jobId: string; light?: boolean }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }

    let isMounted = true;
    fetchSavedJobs().then((jobs) => {
      if (isMounted) {
        setSaved(jobs.some((item) => item.jobId === jobId));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [jobId, user]);

  async function toggleSaved() {
    if (!ready || loading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
      return;
    }

    setLoading(true);
    const response = await authenticatedFetch(`${API_URL}/users/saved-jobs/${jobId}`, {
      method: saved ? 'DELETE' : 'POST',
    });
    if (response.ok) {
      setSaved((current) => !current);
      // Invalidate cache on toggle so next fetch is fresh
      savedJobsCache = null;
      lastFetchTime = 0;
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={!ready || loading}
      aria-label={saved ? 'Remove from saved jobs' : 'Save job'}
      title={saved ? 'Remove from saved jobs' : 'Save job'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${
        light
          ? 'bg-pageBg text-muted hover:bg-brandGreen/10 hover:text-brandGreen'
          : 'bg-white/10 text-white/60 hover:text-[#d8ff3e]'
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark className={`h-4 w-4 ${saved ? 'fill-brandGreen text-brandGreen' : ''}`} />
      )}
    </button>
  );
}
