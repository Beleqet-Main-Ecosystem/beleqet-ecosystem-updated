'use client';

import { useEffect, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { fetchAuditLogs } from '@/lib/api/audit-trail';
import { ACTION_LABELS } from '@/lib/audit-action-labels';
import type { AuditLog, AuditQueryParams } from '@/types/audit-trail';
import ActionBadge from './ActionBadge';
import EmptyState from './EmptyState';

interface AuditTableProps {
  filters: AuditQueryParams;
  token: string;
  onViewLog: (logId: string) => void;
  onFiltersChange: (filters: AuditQueryParams) => void;
}

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const columnHelper = createColumnHelper<AuditLog>();

const columns = [
  columnHelper.accessor('createdAt', {
    header: 'Timestamp',
    cell: (info) => (
      <span className="text-sm text-gray-600 whitespace-nowrap">
        {formatter.format(new Date(info.getValue()))}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'actor',
    header: 'Actor',
    cell: ({ row }) => (
      <div className="text-sm">
        <div className="text-gray-900">{row.original.actorEmail ?? '—'}</div>
        {row.original.actorRole && (
          <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 mt-0.5">
            {row.original.actorRole}
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor('action', {
    header: 'Action',
    cell: (info) => <ActionBadge action={info.getValue()} label={ACTION_LABELS[info.getValue()]} />,
  }),
  columnHelper.accessor('entityType', {
    header: 'Entity Type',
    cell: (info) => <span className="text-sm text-gray-700">{info.getValue()}</span>,
  }),
  columnHelper.accessor('entityId', {
    header: 'Entity ID',
    cell: (info) => (
      <span className="text-sm text-gray-600 font-mono truncate max-w-[120px] block">
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  columnHelper.accessor('ipAddress', {
    header: 'IP Address',
    cell: (info) => (
      <span className="text-sm text-gray-600 font-mono">{info.getValue() ?? '—'}</span>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: () => null,
  }),
];

export default function AuditTable({
  filters,
  token,
  onViewLog,
  onFiltersChange,
}: AuditTableProps) {
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchAuditLogs(filters, token, controller.signal)
      .then((result) => {
        setData(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setData([]);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [filters, token]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    rowCount: total,
  });

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-100 border-b border-gray-200" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-gray-100 flex items-center px-4 gap-4">
              <div className="h-3 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-40" />
              <div className="h-5 bg-gray-200 rounded-full w-24" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onViewLog(row.original.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewLog(row.original.id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{' '}
          {total.toLocaleString()} logs
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
