'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { FraudAlert } from '@/types/fraud';
import { getFraudAlert, resolveFraudAlert } from '@/lib/api';
import { ApiErrorState } from '@/components/fraud/ApiErrorState';

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-gray-400 mb-0.5">{label}</span>
      <span className="font-semibold text-gray-800">{value}</span>
    </div>
  );
}

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

export default function FraudAlertDetailPage() {
  const params = useParams<{ id: string }>();
  const [alert, setAlert] = useState<FraudAlert | null>(null);
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [loadError, setLoadError] = useState<(Error & { status?: number }) | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getFraudAlert(params.id)
      .then(({ alert: a, context: c }) => {
        setAlert(a);
        setContext(c);
      })
      .catch((e) => setLoadError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleResolve = async (status: 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED') => {
    setResolving(true);
    setMessage(null);
    try {
      const result = await resolveFraudAlert(params.id, { status, resolutionNote });
      setAlert(result.alert);
      setMessage({ text: `Alert marked as ${status.replace(/_/g, ' ').toLowerCase()}`, ok: true });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-gray-400">Loading alert…</p>
      </div>
    );
  }
  if (loadError) return <ApiErrorState error={loadError} />;
  if (!alert) return <p className="px-6 py-6 text-sm text-gray-500">Alert not found.</p>;

  return (
    <div className="px-6 py-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/admin/fraud-alerts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Fraud Alerts
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Fraud Alert{' '}
        <span className="font-mono text-base text-gray-400">#{alert.id.slice(0, 8)}</span>
      </h1>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.ok
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main details card */}
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              SEVERITY_BADGE[alert.severity] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {alert.severity}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_BADGE[alert.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {alert.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <InfoField label="Rule Type" value={alert.ruleType.replace(/_/g, ' ')} />
          <InfoField label="Score" value={`${alert.score} / 100`} />
          <InfoField label="Entity Type" value={alert.entityType} />
          <InfoField label="Currency" value={alert.currency ?? 'N/A'} />
          <InfoField label="Created" value={new Date(alert.createdAt).toLocaleString()} />
          {alert.resolvedAt && (
            <InfoField label="Resolved" value={new Date(alert.resolvedAt).toLocaleString()} />
          )}
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-gray-500">Reason</span>
          <p className="mt-1 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {alert.reason}
          </p>
        </div>

        {alert.evidence && (
          <div className="mt-4">
            <span className="text-xs font-medium text-gray-500">Evidence</span>
            <pre className="mt-1 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        )}

        {alert.resolutionNote && (
          <div className="mt-4">
            <span className="text-xs font-medium text-gray-500">Resolution Note</span>
            <p className="mt-1 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {alert.resolutionNote}
            </p>
          </div>
        )}

        {alert.user && (
          <div className="mt-4 border-t pt-4">
            <span className="text-xs font-medium text-gray-500">Flagged User</span>
            <p className="mt-1 text-sm text-gray-800">
              {alert.user.firstName} {alert.user.lastName}{' '}
              <span className="text-gray-400">({alert.user.email})</span>
            </p>
          </div>
        )}
      </div>

      {/* Context card */}
      {context && Object.keys(context).some((k) => context[k]) && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Related Context</h2>
          {(['message', 'user', 'job'] as const).map((key) =>
            context[key] ? (
              <div key={key} className="mb-3">
                <span className="text-xs font-medium capitalize text-gray-500">{key}</span>
                <pre className="mt-1 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  {JSON.stringify(context[key], null, 2)}
                </pre>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Resolve actions — only shown for OPEN alerts */}
      {alert.status === 'OPEN' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Resolve Alert</h2>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Add a resolution note (optional)…"
            aria-label="Resolution note"
            rows={3}
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleResolve('RESOLVED')}
              disabled={resolving}
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {resolving ? 'Saving…' : 'Mark Resolved'}
            </button>
            <button
              onClick={() => handleResolve('FALSE_POSITIVE')}
              disabled={resolving}
              className="rounded-lg bg-gray-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
            >
              {resolving ? 'Saving…' : 'Mark False Positive'}
            </button>
            <button
              onClick={() => handleResolve('CONFIRMED')}
              disabled={resolving}
              className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {resolving ? 'Saving…' : 'Confirm Fraud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
