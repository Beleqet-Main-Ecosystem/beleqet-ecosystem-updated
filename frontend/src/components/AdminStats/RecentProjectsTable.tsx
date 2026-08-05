'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { ProjectBreakdownResponse } from '@/types';
import { formatShortDate } from '@/lib/format';
import { paginateItems, RECENT_PROJECTS_PAGE_SIZE } from '@/lib/paginate';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-muted',
  FUNDED: 'badge-open',
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-active',
  COMPLETED: 'badge-resolved',
  CANCELLED: 'badge-disputed',
};

interface RecentProjectsTableProps {
  data: ProjectBreakdownResponse;
  onExport: () => void;
  exporting?: boolean;
  pageSize?: number;
}

/**
 * Recent freelance projects — owner first name only (no email/phone).
 * Shows {@link RECENT_PROJECTS_PAGE_SIZE} rows per page with pagination.
 */
export function RecentProjectsTable({
  data,
  onExport,
  exporting,
  pageSize = RECENT_PROJECTS_PAGE_SIZE,
}: RecentProjectsTableProps) {
  const [page, setPage] = useState(1);
  const listKey = `${data.recentProjects.length}:${data.recentProjects[0]?.id ?? ''}`;
  const slice = paginateItems(data.recentProjects, page, pageSize);

  useEffect(() => {
    setPage(1);
  }, [listKey, pageSize]);

  return (
    <div className="table-container surface-card">
      <div className="table-header-row">
        <div>
          <div className="table-title">Recent projects</div>
          <div className="chart-subtitle" style={{ marginBottom: 0 }}>
            {data.recentProjects.length === 0
              ? 'No freelance jobs yet · first name only'
              : `Showing ${slice.fromIndex}–${slice.toIndex} of ${slice.totalItems} · ${pageSize} per page · first name only`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onExport}
          disabled={exporting}
          aria-label="Export recent projects CSV"
        >
          <FileSpreadsheet size={16} strokeWidth={2} />
          CSV
        </button>
      </div>

      {data.recentProjects.length === 0 ? (
        <div className="empty-chart">No recent projects</div>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Budget</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {slice.items.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <div className="project-title truncate">{project.title}</div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[project.status] || 'badge-open'}`}>
                        {project.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="table-cell-strong">{project.ownerFirstName}</td>
                    <td className="table-cell-strong">
                      {project.budgetMin.toLocaleString()} – {project.budgetMax.toLocaleString()}{' '}
                      {project.currency}
                    </td>
                    <td>{formatShortDate(project.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination" role="navigation" aria-label="Recent projects pages">
            <span className="table-pagination-meta">
              Page {slice.page} of {slice.totalPages}
            </span>
            <div className="table-pagination-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={slice.page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} strokeWidth={2} />
                Prev
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.min(slice.totalPages, p + 1))}
                disabled={slice.page >= slice.totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        </>
      )}

      {(data.employmentJobsSummary.length > 0 || data.contractsSummary.length > 0) && (
        <div className="table-footer-chips">
          {data.employmentJobsSummary.map((j) => (
            <span key={`job-${j.status}`} className="chip">
              Job {j.status}: {j.count}
            </span>
          ))}
          {data.contractsSummary.map((c) => (
            <span key={`contract-${c.status}`} className="chip">
              Contract {c.status}: {c.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
