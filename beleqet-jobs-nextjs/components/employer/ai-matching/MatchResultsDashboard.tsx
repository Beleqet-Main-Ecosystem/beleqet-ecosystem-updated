"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, SearchX, AlertCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { getJobMatches } from "./api";
import type { MatchResponse } from "./types";
import CandidateMatchCard from "./CandidateMatchCard";

interface JobSummary {
  readonly id: string;
  readonly title: string;
}
interface MatchResultsDashboardProps {
  readonly jobId: string;
  readonly jobs: readonly JobSummary[];
}

export default function MatchResultsDashboard({
  jobId,
  jobs,
}: MatchResultsDashboardProps) {
  const [cache, setCache] = useState<ReadonlyMap<string, MatchResponse>>(new Map());
  const [loadingJobId, setLoadingJobId] = useState<string | null>(jobId);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const data = cache.get(jobId) ?? null;
  const jobTitle = jobs.find((j) => j.id === jobId)?.title ?? jobId;
  const loading = loadingJobId === jobId;

  const fetchMatches = useCallback(
    async (showLoading: boolean) => {
      if (showLoading) setLoadingJobId(jobId);
      setError(null);
      const { data: result, error: err } = await getJobMatches(jobId);
      if (err) {
        setError(err);
      } else if (result) {
        setCache((prev) => {
          const next = new Map(prev);
          next.set(jobId, result);
          return next;
        });
      }
      setLoadingJobId(null);
      setRefreshing(false);
    },
    [jobId],
  );

  // When jobId changes: keep cached results visible (if any) and trigger a
  // silent background refresh. If no cache exists, show a loading spinner
  // and do a full fetch.
  useEffect(() => {
    if (cache.has(jobId)) {
      setError(null);
      fetchMatches(false);
    } else {
      fetchMatches(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Auto-poll every 30s once we have cached results for the displayed job
  useEffect(() => {
    if (!cache.has(jobId)) return;
    const interval = setInterval(() => {
      getJobMatches(jobId).then(({ data: result, error: err }) => {
        if (!err && result) {
          setCache((prev) => {
            const next = new Map(prev);
            next.set(jobId, result);
            return next;
          });
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [jobId, cache]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatches(false);
  };

  if (!jobId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="mb-3 h-12 w-12" />
        <p className="text-lg font-medium text-gray-500">No job selected</p>
        <p className="mt-1 text-sm text-gray-400">
          Post a job first, then return here to find AI-matched candidates.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="mt-3 text-sm text-gray-500">
          Analyzing {jobTitle} against available freelancers…
        </span>
        <span className="mt-1 text-xs text-gray-400">
          This takes a few seconds while each candidate is evaluated.
        </span>
      </div>
    );
  }

  if (error) {
    const isConnectionError = error.status === 0;
    const isNotFound = error.status === 404;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        {isNotFound ? (
          <AlertTriangle className="mb-3 h-12 w-12" />
        ) : (
          <AlertCircle className="mb-3 h-12 w-12" />
        )}
        <p className="text-lg font-medium text-gray-500">
          {isNotFound
            ? "Job not found"
            : "Failed to load match results"}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {isNotFound
            ? `Job "${jobId}" does not exist. Select a valid job from the dropdown above.`
            : isConnectionError
              ? "Cannot reach the server. Check that the backend is running."
              : error.message}
        </p>
        <button
          onClick={() => fetchMatches(true)}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Retry
       </button>
      </div>
    );
  }

  if (!data || data.candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <SearchX className="mb-3 h-12 w-12" />
        <p className="text-lg font-medium text-gray-500">
          No matches found yet.
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Check back later or adjust the job requirements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Top Matches for <span className="text-brandGreen">{jobTitle}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {data.candidates.length} candidate
            {data.candidates.length !== 1 ? "s" : ""} found
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {data.candidates.map((candidate) => (
          <CandidateMatchCard key={candidate.freelancerId} candidate={candidate} />
        ))}
      </div>
    </div>
  );
}
