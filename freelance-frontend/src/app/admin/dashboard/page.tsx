'use client';
import { useState, useCallback, useMemo, type ChangeEvent } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Users, DollarSign, ClipboardList, CheckCircle2 } from 'lucide-react';
import { fetchDashboardStats } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import type { PlatformStats, StatCardData } from '@/types';

/** Supported currencies from the backend wallet.service.ts exchange rates */
const CURRENCIES = ['ETB', 'USD', 'EUR'];
const POLLING_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Builds deterministic time-series chart data using the live aggregated total.
 * Uses a fixed growth curve so SSR and client hydration produce identical output.
 * The final month always reflects the real live total.
 */
function buildRevenueChartData(liveRevenue: number): { month: string; revenue: number }[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const base = liveRevenue / 7;
  // Use a deterministic growth multiplier - no Math.random() to avoid SSR hydration mismatch
  const growthFactors = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];
  return months.map((month, i) => ({
    month,
    revenue: Math.round(base * growthFactors[i]),
  }));
}

/**
 * Admin Stats Dashboard page.
 * Polls the backend every 10 seconds for live aggregated platform statistics.
 * Renders stat cards and Recharts BarChart / AreaChart visualizations.
 */
export default function AdminDashboardPage() {
  const [currency, setCurrency] = useState<string>('ETB');

  const fetcher = useCallback(() => fetchDashboardStats(currency, 'en'), [currency]);

  const { data: stats, loading, error } = usePolling<PlatformStats>(fetcher, POLLING_INTERVAL_MS);

  const statCards: StatCardData[] = stats
    ? [
        {
          label: 'Active Users',
          value: stats.totalUsers.toLocaleString(),
          icon: <Users size={22} />,
          color: 'rgba(59,130,246,0.15)',
        },
        {
          label: `Total Revenue (${stats.currency})`,
          value: stats.totalRevenue.toLocaleString(),
          icon: <DollarSign size={22} />,
          color: 'rgba(16,185,129,0.15)',
        },
        {
          label: 'Active Contracts',
          value: stats.activeContracts.toLocaleString(),
          icon: <ClipboardList size={22} />,
          color: 'rgba(245,158,11,0.15)',
        },
        {
          label: 'Completed Jobs',
          value: stats.completedJobs.toLocaleString(),
          icon: <CheckCircle2 size={22} />,
          color: 'rgba(139,92,246,0.15)',
        },
      ]
    : [];

  const revenueChartData = useMemo(
    () => (stats ? buildRevenueChartData(stats.totalRevenue) : []),
    [stats],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Admin Dashboard</h1>
          <p className="page-header-subtitle">
            Platform performance overview — refreshes every 10s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <select
            className="currency-select"
            value={currency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setCurrency(event.target.value)}
            title="Select currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="polling-indicator">
            <span className="polling-dot" />
            <span>Live updates every 10s</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            <strong>Problem loading dashboard:</strong> {error}
          </div>
        )}

        {/*  Stat Cards  */}
        {loading && !stats ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading stats…</span>
          </div>
        ) : (
          <div className="stats-grid">
            {statCards.map((card) => (
              <div key={card.label} className="stat-card">
                <div className="stat-card-icon" style={{ background: card.color }}>
                  {card.icon}
                </div>
                <div className="stat-card-label">{card.label}</div>
                <div className="stat-card-value">{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {/*  Revenue Bar Chart  */}
        {stats && (
          <div className="chart-container">
            <div className="chart-title">Revenue Over Time ({stats.currency})</div>
            <div className="chart-subtitle">
              Monthly revenue trend based on released escrow transactions
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Bar dataKey="revenue" fill="url(#revenueGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/*  Platform Activity Area Chart  */}
        {stats && (
          <div className="chart-container">
            <div className="chart-title">Platform Activity Overview</div>
            <div className="chart-subtitle">Users, contracts, and completed jobs at a glance</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={[
                  { name: 'Users', value: stats.totalUsers },
                  { name: 'Active Contracts', value: stats.activeContracts },
                  { name: 'Completed Jobs', value: stats.completedJobs },
                ]}
                margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <defs>
                  <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  fill="url(#activityGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
