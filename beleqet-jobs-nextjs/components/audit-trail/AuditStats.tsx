'use client';

import { useEffect, useState } from 'react';
import { fetchAuditStats } from '@/lib/api/audit-trail';
import { ACTION_LABELS } from '@/lib/audit-action-labels';
import type { AuditAction, AuditStats } from '@/types/audit-trail';

interface AuditStatsProps {
  fromDate?: string;
  toDate?: string;
  token: string;
}

export default function AuditStatsBar({ fromDate, toDate, token }: AuditStatsProps) {
  const [stats, setStats] = useState<AuditStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchAuditStats({ fromDate, toDate }, token, controller.signal)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [fromDate, toDate, token]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const top5 = [...stats].sort((a, b) => b.count - a.count).slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded-full w-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Total Logs</span>
          <p className="text-2xl font-semibold text-gray-900">{total.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {top5.map((s) => (
            <span
              key={s.action}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
            >
              <span className="font-semibold">{s.count.toLocaleString()}</span>
              <span>{ACTION_LABELS[s.action as AuditAction] ?? s.action}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
