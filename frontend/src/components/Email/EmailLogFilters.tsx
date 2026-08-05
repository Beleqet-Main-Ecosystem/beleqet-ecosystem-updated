import { Search, X } from 'lucide-react';
import type { EmailLogQuery, EmailStatus, EmailType } from '../types/email';

const STATUS_OPTIONS: EmailStatus[] = ['PENDING', 'QUEUED', 'SENT', 'FAILED', 'BOUNCED'];
const TYPE_OPTIONS: EmailType[] = [
  'WELCOME',
  'PASSWORD_RESET',
  'PAYMENT_RECEIPT',
  'NEWSLETTER',
];

interface Props {
  query: EmailLogQuery;
  onChange: (next: Partial<EmailLogQuery>) => void;
}

/** Filter controls for the Email Logs table. Every field maps 1:1 to a backend query param. */
export function EmailLogFilters({ query, onChange }: Props) {
  const hasActiveFilters = Boolean(
    query.status || query.type || query.recipient || query.from || query.to,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search recipient…"
          value={query.recipient ?? ''}
          onChange={(e) => onChange({ recipient: e.target.value, page: 1 })}
          className="w-56 rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />
      </div>

      <select
        value={query.status ?? ''}
        onChange={(e) =>
          onChange({ status: (e.target.value || undefined) as EmailStatus | undefined, page: 1 })
        }
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={query.type ?? ''}
        onChange={(e) =>
          onChange({ type: (e.target.value || undefined) as EmailType | undefined, page: 1 })
        }
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      >
        <option value="">All types</option>
        {TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t.replace('_', ' ')}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={query.from?.slice(0, 10) ?? ''}
        onChange={(e) => onChange({ from: e.target.value || undefined, page: 1 })}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
      />
      <span className="text-sm text-slate-400">to</span>
      <input
        type="date"
        value={query.to?.slice(0, 10) ?? ''}
        onChange={(e) => onChange({ to: e.target.value || undefined, page: 1 })}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 focus:border-slate-500 focus:outline-none"
      />

      {hasActiveFilters && (
        <button
          onClick={() =>
            onChange({
              status: undefined,
              type: undefined,
              recipient: undefined,
              from: undefined,
              to: undefined,
              page: 1,
            })
          }
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
