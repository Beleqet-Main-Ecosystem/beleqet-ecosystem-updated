'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuditStatsBar from '@/components/audit-trail/AuditStats';
import AuditFilters from '@/components/audit-trail/AuditFilters';
import AuditTable from '@/components/audit-trail/AuditTable';
import AuditLogDetailModal from '@/components/audit-trail/AuditLogDetail';
import { exportAuditCsv } from '@/lib/api/audit-trail';
import { useAuth } from '@/components/AuthProvider';
import { getToken } from '@/lib/auth';
import type { AuditQueryParams } from '@/types/audit-trail';

export default function AuditTrailPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [filters, setFilters] = useState<AuditQueryParams>({
    page: 1,
    limit: 20,
  });
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const token = getToken();

  async function handleExportCsv() {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await exportAuditCsv(filters, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-logs.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brandGreen border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    router.replace(`/login?next=/admin/audit-trail`);
    return null;
  }

  const authToken = token!;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor all platform activity and security events
            </p>
          </div>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        <AuditStatsBar fromDate={filters.fromDate} toDate={filters.toDate} token={authToken} />

        <div className="flex gap-6 items-start">
          <div className="w-64 shrink-0">
            <AuditFilters filters={filters} onFilterChange={setFilters} />
          </div>

          <div className="flex-1 min-w-0">
            <AuditTable
              filters={filters}
              token={authToken}
              onViewLog={setSelectedLogId}
              onFiltersChange={setFilters}
            />
          </div>
        </div>

        {selectedLogId && (
          <AuditLogDetailModal
            logId={selectedLogId}
            token={authToken}
            onClose={() => setSelectedLogId(null)}
          />
        )}
      </div>
    </div>
  );
}
