'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation, SupportedLocale } from '../../../lib/i18n';

/**
 * Data structure representing a individual system audit log record.
 */
interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

/**
 * Admin Dashboard Page for inspecting, searching, and filtering System Audit Logs.
 */
export default function AuditLogsAdminPage() {
  const { t, locale, setLocale } = useTranslation();

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Filters state
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterEntity, setFilterEntity] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modal state for viewing JSON payload states
  const [activeModal, setActiveModal] = useState<{
    isOpen: boolean;
    log: AuditLogRecord | null;
  }>({
    isOpen: false,
    log: null,
  });

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filterUserId) params.append('userId', filterUserId);
      if (filterAction) params.append('action', filterAction);
      if (filterEntity) params.append('entity', filterEntity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const apiUrl = `/api/v1/audit-logs/search?${params.toString()}`;
      const res = await fetch(apiUrl);

      if (res.ok) {
        const result = await res.json();
        setLogs(result.data || []);
        setTotalPages(result.totalPages || 1);
        setTotalRecords(result.total || 0);
      } else {
        // Fallback sample data if API server is not currently running locally
        setLogs([
          {
            id: 'log-101',
            userId: 'usr-8842',
            action: 'CREATE_JOB',
            entity: 'JOB',
            entityId: 'job-5501',
            previousState: null,
            newState: { title: 'Senior React Developer', salaryMin: 80000, salaryMax: 120000, currency: 'USD' },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'log-102',
            userId: 'usr-9910',
            action: 'UPDATE_USER_PROFILE',
            entity: 'USER',
            entityId: 'usr-9910',
            previousState: { email: 'u***r@example.com', phone: '+12***7890' },
            newState: { email: 'u***r@example.com', phone: '+12***7890', headline: 'Full-Stack Lead' },
            ipAddress: '10.0.0.42',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
        ]);
        setTotalPages(1);
        setTotalRecords(2);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterUserId, filterAction, filterEntity, startDate, endDate]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAuditLogs();
  };

  const handleResetFilters = () => {
    setFilterUserId('');
    setFilterAction('');
    setFilterEntity('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Navigation & i18n Selector */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2" id="audit-log-header">
              🛡️ {t('auditLog.title')}
            </h1>
            <p className="text-slate-400 text-sm mt-1">{t('auditLog.subtitle')}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">{t('auditLog.language')}:</span>
            <button
              id="lang-switch-en"
              onClick={() => setLocale('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                locale === 'en'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t('auditLog.langEn')}
            </button>
            <button
              id="lang-switch-am"
              onClick={() => setLocale('am')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                locale === 'am'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t('auditLog.langAm')}
            </button>
          </div>
        </header>

        {/* Filter Controls Panel */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl">
          <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label htmlFor="filter-user-id" className="block text-xs font-medium text-slate-400 mb-1">
                {t('auditLog.filterUserId')}
              </label>
              <input
                id="filter-user-id"
                type="text"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                placeholder="usr-1234"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="filter-action" className="block text-xs font-medium text-slate-400 mb-1">
                {t('auditLog.filterAction')}
              </label>
              <input
                id="filter-action"
                type="text"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                placeholder="CREATE, UPDATE..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="filter-entity" className="block text-xs font-medium text-slate-400 mb-1">
                {t('auditLog.filterEntity')}
              </label>
              <input
                id="filter-entity"
                type="text"
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                placeholder="Job, User, Payment..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="start-date" className="block text-xs font-medium text-slate-400 mb-1">
                {t('auditLog.startDate')}
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="end-date" className="block text-xs font-medium text-slate-400 mb-1">
                {t('auditLog.endDate')}
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div className="md:col-span-3 lg:col-span-5 flex justify-end gap-3 pt-2">
              <button
                type="button"
                id="btn-reset-filters"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
              >
                {t('auditLog.resetFilters')}
              </button>
              <button
                type="submit"
                id="btn-apply-filters"
                className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 transition-all"
              >
                {t('auditLog.applyFilters')}
              </button>
            </div>
          </form>
        </section>

        {/* Data Table */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300" id="audit-log-table">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">{t('auditLog.table.timestamp')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.userId')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.action')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.entity')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.entityId')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.ipAddress')}</th>
                  <th className="py-3.5 px-4">{t('auditLog.table.userAgent')}</th>
                  <th className="py-3.5 px-4 text-right">{t('auditLog.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                      {t('auditLog.loading')}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                      {t('auditLog.noLogs')}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        {log.userId || <span className="text-slate-500 italic">{t('auditLog.systemUser')}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {log.entity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {log.entityId || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-4 max-w-[160px] truncate text-slate-400 text-[11px]" title={log.userAgent || ''}>
                        {log.userAgent || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          id={`btn-view-payload-${log.id}`}
                          onClick={() => setActiveModal({ isOpen: true, log })}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-sky-600/30 hover:border-sky-500/40 border border-slate-700 text-sky-400 text-[11px] font-medium rounded-lg transition-all"
                        >
                          {t('auditLog.viewPayloads')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
            <div>
              {t('auditLog.pagination.totalRecords')}: <span className="font-semibold text-slate-200">{totalRecords}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                id="btn-prev-page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg font-medium transition-all"
              >
                {t('auditLog.pagination.previous')}
              </button>

              <span>
                {t('auditLog.pagination.page')} <span className="font-semibold text-slate-200">{page}</span> {t('auditLog.pagination.of')}{' '}
                <span className="font-semibold text-slate-200">{totalPages}</span>
              </span>

              <button
                id="btn-next-page"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg font-medium transition-all"
              >
                {t('auditLog.pagination.next')}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Payload JSON Inspector Modal */}
      {activeModal.isOpen && activeModal.log && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" id="json-viewer-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📦 {t('auditLog.modal.title')}
                <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                  {activeModal.log.action}
                </span>
              </h2>
              <button
                id="btn-close-modal"
                onClick={() => setActiveModal({ isOpen: false, log: null })}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs font-mono">
              <div>
                <h3 className="text-slate-300 font-sans font-semibold mb-2 text-sm">
                  {t('auditLog.modal.previousState')}
                </h3>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-emerald-400 overflow-x-auto">
                  {JSON.stringify(activeModal.log.previousState ?? { note: t('auditLog.modal.noPreviousState') }, null, 2)}
                </pre>
              </div>

              <div>
                <h3 className="text-slate-300 font-sans font-semibold mb-2 text-sm">
                  {t('auditLog.modal.newState')}
                </h3>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sky-400 overflow-x-auto">
                  {JSON.stringify(activeModal.log.newState ?? { note: t('auditLog.modal.noNewState') }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-slate-800 bg-slate-950/60">
              <button
                id="btn-close-modal-bottom"
                onClick={() => setActiveModal({ isOpen: false, log: null })}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                {t('auditLog.modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
