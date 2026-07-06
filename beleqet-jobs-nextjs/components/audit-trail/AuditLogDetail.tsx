'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchAuditLog } from '@/lib/api/audit-trail';
import { ACTION_LABELS } from '@/lib/audit-action-labels';
import type { AuditAction, AuditLogDetail } from '@/types/audit-trail';
import ActionBadge from './ActionBadge';

interface AuditLogDetailProps {
  logId: string;
  token: string;
  onClose: () => void;
}

export default function AuditLogDetailModal({ logId, token, onClose }: AuditLogDetailProps) {
  const [log, setLog] = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchAuditLog(logId, token, controller.signal)
      .then((data) => {
        setLog(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [logId, token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'long',
  });

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Audit Log Detail</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="p-6 space-y-3 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-full" />
            ))}
          </div>
        )}

        {!loading && log && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="ID" value={log.id} />
              <Field
                label="Action"
                value={
                  <ActionBadge
                    action={log.action}
                    label={ACTION_LABELS[log.action as AuditAction] ?? log.action}
                  />
                }
              />
              <Field label="Actor ID" value={log.actorId ?? '—'} />
              <Field label="Actor Email" value={log.actorEmail ?? '—'} />
              <Field label="Actor Role" value={log.actorRole ?? '—'} />
              <Field label="Entity Type" value={log.entityType} />
              <Field label="Entity ID" value={log.entityId ?? '—'} />
              <Field label="IP Address" value={log.ipAddress ?? '—'} />
              <Field label="Correlation ID" value={log.correlationId ?? '—'} />
              <Field label="Created At" value={formatter.format(new Date(log.createdAt))} />
            </div>

            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                User Agent
              </span>
              <p className="mt-1 text-sm text-gray-700 break-all">{log.userAgent ?? '—'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Integrity
              </span>
              <div className="mt-1">
                {log.integrityValid ? (
                  <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                    <span>✓</span> Integrity verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-700 text-sm font-medium">
                    <span>⚠</span> Integrity mismatch
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Metadata
              </span>
              <pre className="mt-1 bg-gray-50 rounded p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="mt-1 text-sm text-gray-700 break-all">{value}</div>
    </div>
  );
}
