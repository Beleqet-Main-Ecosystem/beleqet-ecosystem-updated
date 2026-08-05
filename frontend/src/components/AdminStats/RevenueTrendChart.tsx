'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RevenueChartResponse } from '@/types';
import { formatChartTick, formatMinorMoney } from '@/lib/format';
import { DASH_CHART, DASH_TOOLTIP } from './chartTheme';

interface RevenueTrendChartProps {
  data: RevenueChartResponse;
}

/**
 * Revenue area chart — backend already zero-fills missing days/months.
 */
export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  const chartData = data.series.map((point) => ({
    ...point,
    label: formatChartTick(point.date, data.granularity),
    display: point.revenue / 100,
  }));

  return (
    <div className="chart-container">
      <div className="chart-header-row">
        <div>
          <div className="chart-title">Revenue</div>
          <div className="chart-subtitle">
            Platform income ({data.currency}) · {data.range.from} → {data.range.to}
            {data.granularity === 'day' ? ' · daily' : ' · monthly'}
            {data.sources && (
              <>
                {' '}
                · fees {formatMinorMoney(data.sources.platformFees, data.currency)} · gateway{' '}
                {formatMinorMoney(data.sources.gatewayPayments, data.currency)} · subs{' '}
                {formatMinorMoney(data.sources.subscriptions, data.currency)}
              </>
            )}
          </div>
        </div>
        <div className="chart-total">
          <span className="chart-total-label">Period total</span>
          <span className="chart-total-value">
            {formatMinorMoney(data.totals.revenue, data.currency)}
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64b5f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#64b5f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={DASH_CHART.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
            stroke="transparent"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v)
            }
          />
          <Tooltip
            cursor={{ stroke: DASH_CHART.muted, strokeWidth: 1 }}
            contentStyle={DASH_TOOLTIP}
            formatter={(value: number) => [
              formatMinorMoney(Math.round(value * 100), data.currency),
              'Revenue',
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Area
            type="monotone"
            dataKey="display"
            stroke={DASH_CHART.blue}
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#64b5f6' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
