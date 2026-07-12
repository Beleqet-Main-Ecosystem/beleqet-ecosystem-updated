'use client';

import { AuditAction, type AuditQueryParams } from '@/types/audit-trail';
import { ACTION_LABELS } from '@/lib/audit-action-labels';

const ENTITY_TYPES = [
  'User',
  'Job',
  'Application',
  'Contract',
  'Bid',
  'EscrowTransaction',
  'Wallet',
];

interface AuditFiltersProps {
  filters: AuditQueryParams;
  onFilterChange: (filters: AuditQueryParams) => void;
}

export default function AuditFilters({ filters, onFilterChange }: AuditFiltersProps) {
  function update(patch: Partial<AuditQueryParams>) {
    onFilterChange({ ...filters, ...patch, page: 1 });
  }

  function clearFilters() {
    onFilterChange({ page: 1, limit: filters.limit });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-8">
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Global Search</label>
          <input
            type="text"
            value={filters.search ?? ''}
            onChange={(e) => update({ search: e.target.value || undefined })}
            placeholder="Search by email or action..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
          <select
            value={filters.action ?? ''}
            onChange={(e) => update({ action: e.target.value || undefined })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All actions</option>
            {Object.values(AuditAction).map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Entity Type</label>
          <select
            value={filters.entityType ?? ''}
            onChange={(e) => update({ entityType: e.target.value || undefined })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Actor Search</label>
          <input
            type="text"
            value={filters.actorId ?? ''}
            onChange={(e) => update({ actorId: e.target.value || undefined })}
            placeholder="Actor ID"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(e) => update({ fromDate: e.target.value || undefined })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={filters.toDate ?? ''}
            onChange={(e) => update({ toDate: e.target.value || undefined })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">IP Address</label>
          <input
            type="text"
            value={filters.ipAddress ?? ''}
            onChange={(e) => update({ ipAddress: e.target.value || undefined })}
            placeholder="e.g. 192.168.1.1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={clearFilters}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
