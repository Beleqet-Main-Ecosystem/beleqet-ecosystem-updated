'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Download, RefreshCw, ScrollText } from 'lucide-react';
import { exportAuditLogs, fetchAuditLogs } from '@/lib/api';
import type { AuditLog, AuditLogListResponse, AuditLogQuery } from '@/types';

const CURRENCIES = ['ETB', 'USD', 'EUR'];

/**
 * Admin Audit Log Viewer.
 * Lists HTTP and domain audit events with filters, pagination, and payload detail.
 */
export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogQuery>({
    search: '',
    eventType: '',
    path: '',
    statusCode: '',
    httpMethod: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,
    currency: 'ETB',
    lang: 'en',
  });
  const [response, setResponse] = useState<AuditLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadLogs = useCallback(async (query: AuditLogQuery) => {
    setLoading(true);
    setError('');
    try {
      const cleaned: AuditLogQuery = {
        page: query.page || 1,
        limit: query.limit || 20,
        currency: query.currency || 'ETB',
        lang: query.lang || 'en',
      };
      if (query.search?.trim()) cleaned.search = query.search.trim();
      if (query.eventType?.trim()) cleaned.eventType = query.eventType.trim();
      if (query.path?.trim()) cleaned.path = query.path.trim();
      if (query.httpMethod?.trim()) cleaned.httpMethod = query.httpMethod.trim();
      if (query.from) cleaned.from = new Date(query.from).toISOString();
      if (query.to) cleaned.to = new Date(query.to).toISOString();
      if (query.statusCode !== undefined && query.statusCode !== '') {
        cleaned.statusCode = Number(query.statusCode);
      }

      const data = await fetchAuditLogs(cleaned);
      setResponse(data);
    } catch {
      setError('Failed to load audit logs. Confirm you are signed in as ADMIN.');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs(filters);
    // Initial + page/currency changes only; filter form submits explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.currency, loadLogs]);

  function onFilterChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
    void loadLogs({ ...filters, page: 1 });
  }

  async function handleExport(format: 'json' | 'csv') {
    setExporting(true);
    try {
      await exportAuditLogs({
        ...filters,
        format,
        statusCode: filters.statusCode === '' ? undefined : Number(filters.statusCode),
      });
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const totalPages = response?.meta.totalPages ?? 1;
  const page = response?.meta.page ?? 1;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Audit Logs</h1>
          <p className="page-header-subtitle">
            Monitor HTTP and domain activity with GDPR-safe payloads.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            name="currency"
            value={filters.currency}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, currency: event.target.value, page: 1 }))
            }
            aria-label="Display currency"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void loadLogs(filters)}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={exporting}
            onClick={() => void handleExport('json')}
          >
            <Download size={16} /> JSON
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={exporting}
            onClick={() => void handleExport('csv')}
          >
            <Download size={16} /> CSV
          </button>
        </div>
      </div>

      <div className="page-body">
        <form
          onSubmit={onSubmit}
          className="table-container"
          style={{ marginBottom: 20, padding: 16 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="search">
                Search
              </label>
              <input
                id="search"
                name="search"
                value={filters.search}
                onChange={onFilterChange}
                placeholder="path, event, entity…"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="eventType">
                Event type
              </label>
              <input
                id="eventType"
                name="eventType"
                value={filters.eventType}
                onChange={onFilterChange}
                placeholder="HTTP_REQUEST"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="path">
                Path
              </label>
              <input
                id="path"
                name="path"
                value={filters.path}
                onChange={onFilterChange}
                placeholder="/api/v1/"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="httpMethod">
                Method
              </label>
              <select
                id="httpMethod"
                name="httpMethod"
                value={filters.httpMethod}
                onChange={onFilterChange}
              >
                <option value="">Any</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PATCH">PATCH</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="statusCode">
                Status
              </label>
              <input
                id="statusCode"
                name="statusCode"
                type="number"
                value={filters.statusCode}
                onChange={onFilterChange}
                placeholder="401"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="from">
                From
              </label>
              <input
                id="from"
                name="from"
                type="datetime-local"
                value={filters.from}
                onChange={onFilterChange}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="to">
                To
              </label>
              <input
                id="to"
                name="to"
                type="datetime-local"
                value={filters.to}
                onChange={onFilterChange}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary btn-sm">
              Apply filters
            </button>
          </div>
        </form>

        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        {loading && !response ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading audit logs…</span>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header-row">
              <div className="table-title">
                {response?.message || 'Audit logs'} · {response?.meta.total ?? 0} total
              </div>
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
                <span>Currency: {response?.currency ?? filters.currency}</span>
              </div>
            </div>

            {!response || response.data.length === 0 ? (
              <div className="empty-state">No audit logs match the current filters.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th>Actor</th>
                    <th>Duration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {response.data.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        <span className="text-primary" style={{ fontWeight: 600, fontSize: 12 }}>
                          {log.eventType}
                        </span>
                      </td>
                      <td>{log.httpMethod || '—'}</td>
                      <td>
                        <span className="truncate">{log.path || '—'}</span>
                      </td>
                      <td>
                        {log.statusCode != null ? (
                          <span
                            className={
                              log.statusCode >= 400 ? 'badge badge-open' : 'badge badge-resolved'
                            }
                          >
                            {log.statusCode}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12 }}>
                          {log.actorUserId ? `#${log.actorUserId.slice(0, 8)}` : 'anonymous'}
                        </span>
                      </td>
                      <td>{log.durationMs != null ? `${log.durationMs}ms` : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelected(log)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {response && response.meta.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 16,
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: page - 1 }))}
                >
                  Previous
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setFilters((prev) => ({ ...prev, page: page + 1 }))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">Audit log detail</div>
            <div className="modal-subtitle">
              {selected.eventType} · {selected.id}
            </div>
            <div className="form-group">
              <label className="form-label">Metadata</label>
              <textarea
                readOnly
                value={JSON.stringify(
                  {
                    entityId: selected.entityId,
                    entityType: selected.entityType,
                    actorUserId: selected.actorUserId,
                    ipAddress: selected.ipAddress,
                    httpMethod: selected.httpMethod,
                    path: selected.path,
                    statusCode: selected.statusCode,
                    durationMs: selected.durationMs,
                    processedBy: selected.processedBy,
                    displayCurrency: selected.displayCurrency,
                    amountInDisplayCurrency: selected.amountInDisplayCurrency,
                    createdAt: selected.createdAt,
                  },
                  null,
                  2,
                )}
                style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Payload (GDPR redacted)</label>
              <textarea
                readOnly
                value={JSON.stringify(selected.payload, null, 2)}
                style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
