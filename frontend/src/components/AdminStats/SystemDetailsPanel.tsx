'use client';

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { OverviewResponse } from '@/types';
import { formatCompactNumber, formatMinorMoney } from '@/lib/format';
import {
  DASH_CHART,
  DASH_ESCROW_COLORS,
  DASH_ROLE_COLORS,
  DASH_TOOLTIP,
} from './chartTheme';

const ROLE_COLORS = DASH_ROLE_COLORS;
const ESCROW_COLORS = DASH_ESCROW_COLORS;

interface SystemDetailsPanelProps {
  overview: OverviewResponse;
}

/**
 * Detailed operational snapshot — role mix, escrow health, funnel, revenue mix.
 * Aggregates only; no emails/phones.
 */
export function SystemDetailsPanel({ overview }: SystemDetailsPanelProps) {
  const { system, currency } = overview;
  const rolePie = system.usersByRole.map((r) => ({
    name: r.role.replace(/_/g, ' '),
    value: r.count,
  }));
  const escrowBars = [
    { name: 'Released', value: system.escrow.releasedCount },
    { name: 'Funded', value: system.escrow.fundedCount },
    { name: 'Pending', value: system.escrow.pendingCount },
    { name: 'Refunded', value: system.escrow.refundedCount },
  ];
  const revenueMix = [
    { name: 'Platform fees', value: Math.max(0, system.revenueBreakdownThisMonth.platformFees) },
    { name: 'Gateway', value: Math.max(0, system.revenueBreakdownThisMonth.gatewayPayments) },
    { name: 'Subscriptions', value: Math.max(0, system.revenueBreakdownThisMonth.subscriptions) },
  ].filter((r) => r.value > 0);

  return (
    <section className="system-details">
      <div className="section-heading">
        <h2>System health</h2>
        <p>Operational detail across users, marketplace activity, escrow, and revenue sources</p>
      </div>

      <div className="detail-metric-grid">
        <DetailMetric label="Inactive users" value={formatCompactNumber(system.inactiveUsers)} />
        <DetailMetric
          label="Unverified emails"
          value={formatCompactNumber(system.unverifiedEmails)}
        />
        <DetailMetric label="KYC pending" value={formatCompactNumber(system.kycPending)} />
        <DetailMetric label="KYC approved" value={formatCompactNumber(system.kycApproved)} />
        <DetailMetric label="Open disputes" value={formatCompactNumber(system.openDisputes)} />
        <DetailMetric
          label="Active subscriptions"
          value={formatCompactNumber(system.activeSubscriptions)}
        />
        <DetailMetric
          label="Applications (range)"
          value={formatCompactNumber(system.applicationsInRange)}
          hint={`${formatCompactNumber(system.applicationsTotal)} all-time`}
        />
        <DetailMetric
          label="Bids (range)"
          value={formatCompactNumber(system.bidsInRange)}
          hint={`${formatCompactNumber(system.bidsTotal)} all-time`}
        />
        <DetailMetric
          label="GMV released (range)"
          value={formatMinorMoney(system.escrow.gmvReleasedInRange, currency)}
        />
        <DetailMetric
          label="Fees in range"
          value={formatMinorMoney(system.escrow.platformFeesInRange, currency)}
        />
        <DetailMetric
          label="Payments succeeded"
          value={formatCompactNumber(system.payments.succeededInRange)}
          hint={formatMinorMoney(system.payments.volumeSucceededInRange, currency)}
        />
        <DetailMetric
          label="Payments failed / refunded"
          value={`${system.payments.failedInRange} / ${system.payments.refundedInRange}`}
        />
      </div>

      <div className="charts-grid charts-grid-triple">
        <div className="chart-container chart-container-compact">
          <div className="chart-title">Users by role</div>
          <div className="chart-subtitle">Account mix across the platform</div>
          <div className="pie-layout">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={rolePie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                >
                  {rolePie.map((_, i) => (
                    <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={DASH_TOOLTIP}
                  formatter={(value: number, name: string) => [value, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="pie-legend">
              {system.usersByRole.map((row, i) => (
                <li key={row.role}>
                  <span
                    className="pie-swatch"
                    style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }}
                  />
                  <span className="pie-legend-label">{row.role.replace(/_/g, ' ')}</span>
                  <span className="pie-legend-value">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="chart-container chart-container-compact">
          <div className="chart-title">Escrow pipeline</div>
          <div className="chart-subtitle">Transaction counts by escrow status</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={escrowBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={DASH_CHART.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'currentColor', fontSize: 12, opacity: 0.75 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip contentStyle={DASH_TOOLTIP} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {escrowBars.map((_, i) => (
                  <Cell key={i} fill={ESCROW_COLORS[i % ESCROW_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container chart-container-compact">
          <div className="chart-title">Revenue mix (this month)</div>
          <div className="chart-subtitle">Where platform income comes from</div>
          {revenueMix.length === 0 ? (
            <div className="empty-chart">No revenue this month yet</div>
          ) : (
            <div className="pie-layout">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueMix}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {revenueMix.map((_, i) => (
                      <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={DASH_TOOLTIP}
                    formatter={(value: number, name: string) => [
                      formatMinorMoney(value, currency),
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="pie-legend">
                {revenueMix.map((row, i) => (
                  <li key={row.name}>
                    <span
                      className="pie-swatch"
                      style={{ background: ROLE_COLORS[i % ROLE_COLORS.length] }}
                    />
                    <span className="pie-legend-label">{row.name}</span>
                    <span className="pie-legend-value">
                      {formatMinorMoney(row.value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="status-chip-row">
        <span className="status-chip-label">Employment jobs</span>
        {system.employmentJobs.length === 0 && <span className="chip">None</span>}
        {system.employmentJobs.map((j) => (
          <span key={j.status} className="chip">
            {j.status.replace(/_/g, ' ')} · {j.count}
          </span>
        ))}
      </div>
      <div className="status-chip-row">
        <span className="status-chip-label">Contracts</span>
        {system.contracts.length === 0 && <span className="chip">None</span>}
        {system.contracts.map((c) => (
          <span key={c.status} className="chip">
            {c.status.replace(/_/g, ' ')} · {c.count}
          </span>
        ))}
      </div>
    </section>
  );
}

function DetailMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="detail-metric">
      <div className="detail-metric-label">{label}</div>
      <div className="detail-metric-value">{value}</div>
      {hint && <div className="detail-metric-hint">{hint}</div>}
    </div>
  );
}
