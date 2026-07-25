"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, ShieldCheck, ShieldAlert, ShieldX, ChevronLeft, ChevronRight } from "lucide-react";
import { getGdprAuditLog } from "./api";
import type { GdprAuditEntry } from "./types";

const PAGE_SIZES = [10, 25, 50] as const;

function maskId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}****` : `${id.slice(0, Math.min(2, id.length))}****`;
}

function PiiBadge({ categories }: { readonly categories: readonly string[] }) {
  if (categories.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
        <ShieldCheck className="h-3 w-3" />
        None
     </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      <ShieldAlert className="h-3 w-3" />
      {categories.join(", ")}
   </span>
  );
}

function ConfirmedBadge({ confirmed }: { readonly confirmed: boolean }) {
  if (!confirmed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <ShieldX className="h-3 w-3" />
        FAILED
     </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <ShieldCheck className="h-3 w-3" />
      Confirmed
   </span>
  );
}

function RedactedFields({ fields }: { readonly fields: readonly string[] }) {
  if (fields.length === 0) {
    return <span className="text-xs text-muted">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {fields.map((f) => (
        <code
          key={f}
          className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono text-gray-600"
        >
          {f}
       </code>
      ))}
   </div>
  );
}

export default function GdprAuditLog() {
  const [entries, setEntries] = useState<readonly GdprAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [contentReady, setContentReady] = useState(false);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const startIndex = safePage * pageSize;
  const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);

  const fetchLog = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setErrorMessage(null);
    try {
      const { data, error } = await getGdprAuditLog();
      if (error || !data) {
        setErrorMessage(
          error?.message ?? "Could not load GDPR audit log.",
        );
      } else {
        setEntries(data);
        setPage(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setContentReady(true);
    }
  }, []);

  useEffect(() => {
    fetchLog(true);
  }, [fetchLog]);

  useEffect(() => {
    setPage(0);
  }, [pageSize, entries.length]);

  if (loading && !contentReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading GDPR audit log…</span>
     </div>
    );
  }

  if (errorMessage && entries.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">GDPR Audit Log</h3>
            <p className="text-xs text-muted">
              Sanitization events confirming PII redaction before external API calls
           </p>
         </div>
          <button
            onClick={() => fetchLog(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Retry
         </button>
       </div>
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-gray-400">
          <ShieldX className="mb-3 h-10 w-10" />
          <p className="text-sm font-medium text-gray-500">
            Could not load GDPR audit log.
         </p>
          <p className="mt-1 max-w-md text-center text-xs text-gray-400">
            {errorMessage}
         </p>
       </div>
     </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">GDPR Audit Log</h3>
          <p className="text-xs text-muted">
            Sanitization events confirming PII redaction before external API calls
         </p>
       </div>
        <button
          onClick={() => fetchLog(false)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-4 py-2 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
       </button>
     </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <ShieldCheck className="mb-3 h-10 w-10 text-green-400" />
          <p className="text-sm font-medium text-gray-500">
            No audit events yet.
         </p>
          <p className="mt-1 max-w-md text-center text-xs text-gray-400">
            As soon as the AI matching pipeline sanitizes a candidate profile, it
            will appear here.
         </p>
       </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                  <th scope="col" className="pb-3 pr-4">Time</th>
                  <th scope="col" className="pb-3 pr-4">Freelancer</th>
                  <th scope="col" className="pb-3 pr-4">Session Token</th>
                  <th scope="col" className="pb-3 pr-4">PII Detected</th>
                  <th scope="col" className="pb-3 pr-4">Fields Redacted</th>
                  <th scope="col" className="pb-3">Status</th>
               </tr>
             </thead>
              <tbody>
                {paginatedEntries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/50 last:border-b-0"
                  >
                    <td className="py-3 pr-4 text-xs text-ink whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                   </td>
                    <td className="py-3 pr-4 text-xs font-mono text-ink whitespace-nowrap">
                      {maskId(e.freelancerId)}
                   </td>
                    <td className="py-3 pr-4 text-xs font-mono text-muted whitespace-nowrap">
                      {maskId(e.sessionToken)}
                   </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <PiiBadge categories={e.piiCategories} />
                   </td>
                    <td className="py-3 pr-4">
                      <RedactedFields fields={e.fieldsRedacted} />
                   </td>
                    <td className="py-3 whitespace-nowrap">
                      <ConfirmedBadge confirmed={e.confirmedPiiFree} />
                   </td>
                 </tr>
                ))}
             </tbody>
           </table>
         </div>

<div className="mt-4 flex items-center justify-between">
             <div className="flex items-center gap-3 text-xs text-muted">
               <span>
                 Showing{' '}
                 <strong className="text-ink">{startIndex + 1}</strong>{' '}
                 –{' '}
                 <strong className="text-ink">{Math.min(startIndex + pageSize, entries.length)}</strong>{' '}
                 of{' '}
                 <strong className="text-ink">{entries.length}</strong>
               </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <span>Rows</span>
                {PAGE_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setPageSize(s); }}
                    className={`rounded px-1.5 py-0.5 font-semibold transition-colors ${
                      pageSize === s
                        ? "bg-gray-200 text-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {s}
                 </button>
                ))}
             </span>
           </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
             </button>
              <span className="mx-2 text-xs tabular-nums text-muted">
                {safePage + 1} / {totalPages}
             </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs font-bold text-muted transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
             </button>
           </div>
         </div>
        </>
      )}

      <div className="mt-4 rounded-lg border border-border bg-gray-50 p-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-green-600" />
          <span>
            <strong className="text-ink">GDPR Compliant</strong> All{" "}
            {entries.length} sanitization events confirmed PII-free before
            reaching external LLM providers.
         </span>
       </div>
     </div>
   </div>
  );
}
