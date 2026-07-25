import { RotateCw, Loader2 } from 'lucide-react';
import { EmailStatusBadge } from './EmailStatusBadge';
import { useResendEmail } from '../../hooks/useEmailLogs';
import type { EmailLogPage } from '../../types/email';

interface Props {
  data: EmailLogPage | undefined;
  isLoading: boolean;
  onSelectLog: (id: string) => void;
  onPageChange: (page: number) => void;
  /** Called after a successful resend so the parent can refetch the list. */
  onResendSuccess: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function EmailLogsTable({
  data,
  isLoading,
  onSelectLog,
  onPageChange,
  onResendSuccess,
}: Props) {
  const { resend, isPending } = useResendEmail();
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Attempts</th>
            <th className="px-4 py-3 font-medium">Sent</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td>
            </tr>
          )}

          {!isLoading && data?.items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                No emails match these filters.
              </td>
            </tr>
          )}

          {data?.items.map((log) => (
            <tr
              key={log.id}
              onClick={() => onSelectLog(log.id)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.recipient}</td>
              <td className="px-4 py-3 text-slate-600">{log.type.replace('_', ' ')}</td>
              <td className="px-4 py-3">
                <EmailStatusBadge status={log.status} />
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.attempts}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">
                {log.sentAt ? dateFormatter.format(new Date(log.sentAt)) : '—'}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">
                {dateFormatter.format(new Date(log.createdAt))}
              </td>
              <td className="px-4 py-3 text-right">
                {(log.status === 'FAILED' || log.status === 'BOUNCED') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resend(log.id, onResendSuccess);
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RotateCw className="h-3 w-3" />
                    Resend
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <span>
            {(data.page - 1) * data.pageSize + 1}
            {'–'}
            {Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange(data.page - 1)}
              disabled={data.page <= 1}
              className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(data.page + 1)}
              disabled={data.page >= totalPages}
              className="rounded-md border border-slate-300 px-2.5 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
