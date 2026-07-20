'use client';
import { useState, useCallback, type ChangeEvent } from 'react';
import { ScrollText, Filter } from 'lucide-react';
import { fetchAuditLogs } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import type { AuditLogPage, AuditLogFilters } from '@/types';

const POLLING_INTERVAL_MS = 10_000;

/** Formats a date string to a human-readable form, including time (audit logs need precision). */
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Returns a CSS badge class based on the event type's category, for quick visual scanning. */
function getEventBadge(eventType: string): string {
  if (eventType.includes('LOGIN') || eventType.includes('LOGOUT')) return 'badge badge-open';
  if (eventType.includes('PAYMENT') || eventType.includes('ESCROW') || eventType.includes('WALLET')) {
    return 'badge badge-resolved';
  }
  return 'badge';
}

/**
 * Audit Trail dashboard page ("The Vault").
 * Admin-only page listing all immutable audit log entries, with
 * filtering by event type, entity type, entity ID, and date range.
 * Polls the backend every 10 seconds for fresh data, matching the
 * existing Dispute Manager page's live-update convention.
 */
export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 25 });
  const [eventTypeInput, setEventTypeInput] = useState('');
  const [entityTypeInput, setEntityTypeInput] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');

  const fetcher = useCallback(() => fetchAuditLogs(filters), [filters]);
  const {
    data: result,
    loading,
    error,
  } = usePolling<AuditLogPage>(fetcher, POLLING_INTERVAL_MS);

  function applyFilters() {
    setFilters({
      page: 1,
      limit: 25,
      eventType: eventTypeInput || undefined,
      entityType: entityTypeInput || undefined,
      entityId: entityIdInput || undefined,
      dateFrom: dateFromInput || undefined,
      dateTo: dateToInput || undefined,
    });
  }

  function clearFilters() {
    setEventTypeInput('');
    setEntityTypeInput('');
    setEntityIdInput('');
    setDateFromInput('');
    setDateToInput('');
    setFilters({ page: 1, limit: 25 });
  }

  const logs = result?.items ?? [];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Audit Trail</h1>
          <p className="page-header-subtitle">
            Immutable record of every critical action on the platform.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {result?.total ?? 0} total entries
          </span>
          <div className="polling-indicator">
            <span className="polling-dot" />
            <span>Live updates every 10s</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="table-container" style={{ marginBottom: 24 }}>
          <div className="table-header-row">
            <div className="table-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} /> Filters
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, padding: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="eventType">Event Type</label>
              <input
                id="eventType"
                value={eventTypeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEventTypeInput(e.target.value)}
                placeholder="e.g. USER_LOGIN"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="entityType">Entity Type</label>
              <input
                id="entityType"
                value={entityTypeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEntityTypeInput(e.target.value)}
                placeholder="e.g. Payment"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="entityId">Entity ID</label>
              <input
                id="entityId"
                value={entityIdInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEntityIdInput(e.target.value)}
                placeholder="Exact ID"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="dateFrom">From</label>
              <input
                id="dateFrom"
                type="date"
                value={dateFromInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDateFromInput(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="dateTo">To</label>
              <input
                id="dateTo"
                type="date"
                value={dateToInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDateToInput(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply</button>
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
            </div>
          </div>
        </div>

        {loading && !result ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading audit trail…</span>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header-row">
              <div className="table-title">Audit Log Entries</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}
              >
                <ScrollText size={16} />
                <span>Append-only · immutable</span>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="empty-state">No audit log entries match your current filters.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Entity</th>
                    <th>Details</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className={getEventBadge(log.eventType)}>{log.eventType}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{log.entityType}</span>
                        <br />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          #{log.entityId.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span className="truncate" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {Object.keys(log.payload).length > 0
                            ? JSON.stringify(log.payload).slice(0, 60)
                            : '—'}
                        </span>
                      </td>
                      <td>{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {result && result.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Previous
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Page {result.page} of {result.totalPages}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={(filters.page ?? 1) >= result.totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
