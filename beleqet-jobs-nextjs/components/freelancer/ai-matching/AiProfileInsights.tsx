"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, UserX, AlertTriangle, RefreshCw } from "lucide-react";
import { getProfileInsights } from "./api";
import type { ProfileInsights } from "./types";
import OptimizationScoreWidget from "./OptimizationScoreWidget";
import ActionableInsights from "./ActionableInsights";

interface AiProfileInsightsProps {
  readonly freelancerId: string;
}

function SkeletonCard({ className }: { readonly className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 h-3 w-24 rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function AiProfileInsights({
  freelancerId,
}: AiProfileInsightsProps) {
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!insights) setLoading(true);
    setError(null);
    try {
      const result = await getProfileInsights(freelancerId);
      setInsights(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load profile insights.";
      setError(message);
    } finally {
      setLoading(false);
      setRetrying(false);
      setRefreshing(false);
    }
  }, [freelancerId, insights]);

  useEffect(() => {
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setInsights(null);
    fetchInsights();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  if (loading && !insights) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mx-auto mb-4 h-32 w-32 rounded-full bg-gray-200" />
          <div className="mx-auto h-4 w-20 rounded bg-gray-200" />
          <div className="mx-auto mt-2 h-3 w-32 rounded bg-gray-100" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="mb-3 h-12 w-12 text-amber-500" />
        <p className="text-lg font-medium text-gray-500">
          Failed to load insights
        </p>
        <p className="mt-1 max-w-md text-center text-sm text-gray-400">
          {error}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <UserX className="mb-3 h-12 w-12" />
        <p className="text-lg font-medium text-gray-500">
          No profile data available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <OptimizationScoreWidget score={insights.optimizationScore} />

        <div className="lg:col-span-2">
          <ActionableInsights insights={insights} />
        </div>
      </div>
    </div>
  );
}
