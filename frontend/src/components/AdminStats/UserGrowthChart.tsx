'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { UserGrowthChartResponse } from '@/types';
import { formatChartTick, formatCompactNumber } from '@/lib/format';
import { DASH_CHART, DASH_TOOLTIP } from './chartTheme';

interface UserGrowthChartProps {
  data: UserGrowthChartResponse;
}

/**
 * Registrations (bars) + active users (line) on one composed chart.
 */
export function UserGrowthChart({ data }: UserGrowthChartProps) {
  const chartData = data.series.map((point) => ({
    ...point,
    label: formatChartTick(point.date, data.granularity),
    active: point.activeUsers ?? 0,
  }));

  return (
    <div className="chart-container">
      <div className="chart-header-row">
        <div>
          <div className="chart-title">User growth</div>
          <div className="chart-subtitle">
            New registrations
            {data.activeUsersAvailable ? ' and active users' : ''} over the selected range
          </div>
        </div>
        <div className="chart-total">
          <span className="chart-total-label">New users</span>
          <span className="chart-total-value">
            {formatCompactNumber(data.totals.registrations)}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={DASH_CHART.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip contentStyle={DASH_TOOLTIP} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: 'var(--dash-text-2)' }}
          />
          <Bar
            dataKey="registrations"
            name="Registrations"
            fill={DASH_CHART.cyan}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
          {data.activeUsersAvailable && (
            <Line
              type="monotone"
              dataKey="active"
              name="Active users"
              stroke={DASH_CHART.orange}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#ffb74d' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
