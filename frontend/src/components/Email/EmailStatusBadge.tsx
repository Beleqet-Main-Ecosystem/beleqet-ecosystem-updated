import { CheckCircle2, XCircle, Clock, AlertTriangle, Hourglass } from 'lucide-react';
import type { EmailStatus } from '../../types/email';

const STATUS_CONFIG: Record<
  EmailStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  SENT: {
    label: 'Sent',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  QUEUED: {
    label: 'Queued',
    icon: Clock,
    className: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  },
  PENDING: {
    label: 'Pending',
    icon: Hourglass,
    className: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
  BOUNCED: {
    label: 'Bounced',
    icon: AlertTriangle,
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
};

/**
 * Renders an email dispatch status as a colored pill with icon.
 * Color is load-bearing here, not decorative: red/amber states are
 * the ones an admin scanning the table needs to catch immediately.
 */
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}
