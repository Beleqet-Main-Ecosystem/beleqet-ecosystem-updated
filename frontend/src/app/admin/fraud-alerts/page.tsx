'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FraudAlert, PaginatedResponse } from '@/types/fraud';
import { getFraudAlerts } from '@/lib/api';
import { ApiErrorState } from '@/components/fraud/ApiErrorState';

const SEVERITY_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
  CRITICAL: 'bg-red-900 text-red-100',
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  FALSE_POSITIVE: 'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-red-100 text-red-800',
};

export default function FraudAlertsPage() {
  const [data, setData] = useState<PaginatedResponse<FraudAlert> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<(Error & { status?: number }) | null>(null);
  const [filter, setFilter] = useState({ status: '', severity: '', ruleType: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getFraudAlerts({ ...filter, page, limit: 15 })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [filter, page]);

  if (loading && !data) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-gray-400">Loading fraud alerts…</p>
      </div>
    );
  }

  if (error) return <ApiErrorState error={error} />;

  return (
    <div className="px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fraud Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and resolve platform fraud incidents.
          </p>
        </div>
        <Link
          href="/admin/fraud-alerts/rules"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Manage Rules
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          {
            label: 'Status',
            value: filter.status,
            key: 'status' as const,
            options: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED'],
          },
          {
            label: 'Severity',
            value: filter.severity,
            key: 'severity' as const,
            options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          },
          {
            label: 'Type',
            value: filter.ruleType,
            key: 'ruleType' as const,
            options: [
              'OFF_PLATFORM_PAYMENT',
              'FAKE_PROFILE',
              'PAYMENT_ANOMALY',
              'DUPLICATE_LISTING',
            ],
          },
        ].map(({ label, value, key, options }) => (
          <select
            key={key}
            value={value}
            onChange={(e) => {
              setFilter((f) => ({ ...f, [key]: e.target.value }));
              setPage(1);
            }}
            aria-label={`Filter by ${label}`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All {label}s</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        ))}
        <button
          onClick={() => {
            setFilter({ status: '', severity: '', ruleType: '' });
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      </div>

      {data && (
        <>
          <p className="mb-3 text-sm text-gray-500">
            Showing{' '}
            {(data.meta.page - 1) * data.meta.limit + 1}–
            {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of{' '}
            {data.meta.total} alerts
          </p>

          <div className="flex flex-col gap-2">
            {data.data.map((alert) => (
              <Link
                key={alert.id}
                href={`/admin/fraud-alerts/${alert.id}`}
                className="block rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-48">
                    <p className="font-semibold text-gray-800">
                      {alert.ruleType.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-500">{alert.reason}</p>
                    {alert.user && (
                      <p className="mt-1 text-xs text-gray-400">
                        {alert.user.firstName} {alert.user.lastName} ({alert.user.email})
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        SEVERITY_BADGE[alert.severity] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE[alert.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {alert.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400">Score: {alert.score}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {data.meta.totalPages > 1 && (
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {data.meta.totalPages}
              </span>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
