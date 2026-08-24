import { X } from 'lucide-react';
import { useEmailLog } from '../../hooks/useEmailLogs';
import { EmailStatusBadge } from './EmailStatusBadge';

interface Props {
  logId: string | null;
  onClose: () => void;
}

/** Side panel with full detail for one email log, notably the error message on failures. */
export function EmailLogDetail({ logId, onClose }: Props) {
  const { data: log, isLoading } = useEmailLog(logId);

  if (!logId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-md border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Email detail</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading || !log ? (
        <div className="p-5 text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-4 p-5 text-sm">
          <div>
            <EmailStatusBadge status={log.status} />
          </div>

          <dl className="space-y-3">
            <Row label="Recipient" value={log.recipient} mono />
            <Row label="Type" value={log.type.replace('_', ' ')} />
            <Row label="Subject" value={log.subject} />
            <Row label="Locale" value={log.locale} />
            <Row label="Template" value={log.templateName} mono />
            <Row label="Attempts" value={String(log.attempts)} />
            <Row label="Log ID" value={log.id} mono />
          </dl>

          {log.errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <div className="mb-1 text-xs font-medium text-red-700">Error</div>
              <div className="font-mono text-xs text-red-600">{log.errorMessage}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`text-right text-slate-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
