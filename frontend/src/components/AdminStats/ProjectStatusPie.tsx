'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ProjectBreakdownResponse } from '@/types';
import { formatCompactNumber } from '@/lib/format';
import { DASH_STATUS_COLORS, DASH_TOOLTIP } from './chartTheme';

const STATUS_COLORS = DASH_STATUS_COLORS;

interface ProjectStatusPieProps {
  data: ProjectBreakdownResponse;
}

/**
 * Project status mix — pie + readable legend (counts, not just colors).
 */
export function ProjectStatusPie({ data }: ProjectStatusPieProps) {
  const slices = data.statusSummary
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.status.replace(/_/g, ' '),
      status: s.status,
      value: s.count,
    }));

  const total = data.statusSummary.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="chart-container chart-container-compact">
      <div className="chart-title">Projects by status</div>
      <div className="chart-subtitle">Share of all freelance projects on the platform</div>

      {total === 0 ? (
        <div className="empty-chart">No projects yet</div>
      ) : (
        <div className="pie-layout">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((slice) => (
                  <Cell
                    key={slice.status}
                    fill={STATUS_COLORS[slice.status] || '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={DASH_TOOLTIP}
                formatter={(value: number, name: string) => [
                  `${value} (${total ? Math.round((value / total) * 100) : 0}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>

          <ul className="pie-legend">
            {data.statusSummary.map((row) => (
              <li key={row.status}>
                <span
                  className="pie-swatch"
                  style={{ background: STATUS_COLORS[row.status] || '#94a3b8' }}
                />
                <span className="pie-legend-label">{row.status.replace(/_/g, ' ')}</span>
                <span className="pie-legend-value">{formatCompactNumber(row.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
