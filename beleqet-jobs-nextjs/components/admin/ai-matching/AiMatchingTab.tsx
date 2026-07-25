"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { getAiMatchingMetrics } from "./api";
import type { AdminApiError } from "./api";
import type { AiMatchingMetrics } from "./types";
import SummaryCards from "./SummaryCards";
import LatencyChart from "./LatencyChart";
import TokenUsageWidget from "./TokenUsageWidget";
import GdprAuditLog from "./GdprAuditLog";

const POLL_INTERVAL_MS = 30_000;
const POLL_BACKOFF_AFTER_ERRORS = 3;

function formatTimestamp(d: Date | null): string {
  if (!d) return "never";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AiMatchingTab() {
  const [metrics, setMetrics] = useState<AiMatchingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollingDisabled = consecutiveErrors >= POLL_BACKOFF_AFTER_ERRORS;

  const fetchMetrics = useCallback(
    async (showLoading: boolean): Promise<void> => {
      if (showLoading) setLoading(true);
      else setRefreshing(true);
      try {
        const { data, error: err } = await getAiMatchingMetrics();
        if (err || !data) {
          setError(
            err ?? {
              status: 0,
              message: "Empty response from server.",
            },
          );
          setConsecutiveErrors((n) => n + 1);
        } else {
          setMetrics(data);
          setError(null);
          setConsecutiveErrors(0);
          setLastUpdated(new Date());
        }
      } finally {
        if (showLoading) setLoading(false);
        else setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchMetrics(true);

    if (pollingDisabled) return undefined;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchMetrics(false);
    }, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) fetchMetrics(false);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchMetrics, pollingDisabled]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-500">Loading matching metrics…</span>
     </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-gray-500">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <p className="text-sm font-medium text-gray-500">
          Failed to load matching metrics.
       </p>
        <p className="max-w-sm text-center text-xs text-gray-400">
          {error?.message ??
            "Check that the backend is running and you have admin access."}
       </p>
        <button
          onClick={() => fetchMetrics(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-5 py-2 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Retry
       </button>
     </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Matching Engine Overview
          <span
            className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-green-600"
            aria-live="polite"
          >
            <Radio
              className={`h-3 w-3 ${lastUpdated && !error ? "animate-pulse" : ""}`}
              aria-hidden="true"
            />
            Live
         </span>
       </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Updated{" "}
            <span className="font-semibold text-ink">
              {formatTimestamp(lastUpdated)}
           </span>
         </span>
          <button
            onClick={() => fetchMetrics(false)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
         </button>
       </div>
     </div>

      {pollingDisabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Auto-refresh paused after multiple errors. Use Refresh to retry
          manually.
       </div>
      )}

      <SummaryCards metrics={metrics} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LatencyChart latency={metrics.latencyBreakdown} />
        <TokenUsageWidget tokenUsage={metrics.tokenUsage} />
     </div>

      <GdprAuditLog />
   </div>
  );
}
