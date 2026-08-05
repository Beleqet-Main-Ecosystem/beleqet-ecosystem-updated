'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { EmailLogFilters } from '../../../components/Email/EmailLogFilters';
import { EmailLogsTable } from '../../../components/Email/EmailLogsTable';
import { EmailLogDetail } from '../../../components/Email/EmailLogDetail';
import { useEmailLogs } from '../../../hooks/useEmailLogs';
import type { EmailLogQuery } from '../../../types/email';

const DEFAULT_QUERY: EmailLogQuery = { page: 1, pageSize: 25 };

export default function EmailLogsPage() {
  const [query, setQuery] = useState<EmailLogQuery>(DEFAULT_QUERY);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useEmailLogs(query);

  function updateQuery(next: Partial<EmailLogQuery>) {
    setQuery((prev) => ({ ...prev, ...next }));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900">
          <Mail className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Email logs</h1>
          <p className="text-sm text-slate-500">
            Every automated email — welcome, password reset, receipts, newsletters — with delivery
            status.
          </p>
        </div>
      </header>

      <EmailLogFilters query={query} onChange={updateQuery} />

      <div className="mt-4">
        <EmailLogsTable
          data={data}
          isLoading={isLoading}
          onSelectLog={setSelectedLogId}
          onPageChange={(page) => updateQuery({ page })}
          onResendSuccess={refetch}
        />
      </div>

      <EmailLogDetail logId={selectedLogId} onClose={() => setSelectedLogId(null)} />
    </div>
  );
}
