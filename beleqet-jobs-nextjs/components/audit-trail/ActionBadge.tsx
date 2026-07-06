import { AuditAction } from '@/types/audit-trail';

interface ActionBadgeProps {
  action: AuditAction | string;
  label?: string;
}

function getBadgeClass(action: string): string {
  if (action.startsWith('AUTH_')) return 'bg-blue-100 text-blue-800';
  if (action === AuditAction.PAYMENT_WITHDRAWAL_FAILED) return 'bg-red-100 text-red-800';
  if (action.startsWith('PAYMENT_')) return 'bg-green-100 text-green-800';
  if (action.startsWith('ADMIN_')) return 'bg-orange-100 text-orange-800';
  if (action.startsWith('CONTRACT_')) return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-800';
}

export default function ActionBadge({ action, label }: ActionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeClass(action)}`}
    >
      {label ?? action}
    </span>
  );
}
