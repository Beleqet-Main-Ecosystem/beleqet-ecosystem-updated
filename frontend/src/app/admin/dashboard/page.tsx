'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Users,
  UserCheck,
  BriefcaseBusiness,
  FolderKanban,
  CircleDollarSign,
  TrendingUp,
  FileSpreadsheet,
  RotateCw,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import {
  SummaryCards,
  RevenueTrendChart,
  UserGrowthChart,
  ProjectStatusPie,
  RecentProjectsTable,
  SystemDetailsPanel,
} from '@/components/AdminStats';
import {
  downloadAdminStatsCsv,
  fetchAdminOverview,
  fetchAdminProjectBreakdown,
  fetchAdminRevenueChart,
  fetchAdminUserGrowthChart,
} from '@/lib/api';
import { formatCompactNumber, formatMinorMoney } from '@/lib/format';
import type {
  OverviewResponse,
  ProjectBreakdownResponse,
  RevenueChartResponse,
  StatsQueryParams,
  StatsRangePreset,
  StatCardData,
  UserGrowthChartResponse,
} from '@/types';

const CURRENCIES = ['ETB', 'USD', 'EUR'];
const RANGES: Array<{ id: StatsRangePreset; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '12m', label: '12 months' },
];
const POLL_MS = 30_000;

function deltaLabel(
  change: OverviewResponse['cards']['revenueChangeVsLastMonth'],
): StatCardData['delta'] {
  const { percentChange, direction } = change;
  if (direction === 'new') return { text: 'New', tone: 'new' };
  if (percentChange === null) return { text: '—', tone: 'flat' };
  const sign = percentChange > 0 ? '+' : '';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '';
  return { text: `${arrow}${sign}${percentChange}%`, tone: direction };
}

/**
 * Admin Stats dashboard — overview cards, system health, Recharts, CSV exports.
 */
export default function AdminDashboardPage() {
  const [currency, setCurrency] = useState('ETB');
  const [range, setRange] = useState<StatsRangePreset>('30d');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [revenue, setRevenue] = useState<RevenueChartResponse | null>(null);
  const [users, setUsers] = useState<UserGrowthChartResponse | null>(null);
  const [projects, setProjects] = useState<ProjectBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const query: StatsQueryParams = useMemo(
    () => ({
      currency,
      range,
      lang: 'en',
      tz: 'Africa/Addis_Ababa',
      recentLimit: 25,
    }),
    [currency, range],
  );

  const load = useCallback(async () => {
    try {
      const [ov, rev, growth, breakdown] = await Promise.all([
        fetchAdminOverview(query),
        fetchAdminRevenueChart(query),
        fetchAdminUserGrowthChart(query),
        fetchAdminProjectBreakdown(query),
      ]);
      setOverview(ov);
      setRevenue(rev);
      setUsers(growth);
      setProjects(breakdown);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setLoading(true);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const cards: StatCardData[] = overview
    ? [
        {
          label: 'Total users',
          value: formatCompactNumber(overview.cards.totalUsers),
          icon: <Users size={22} strokeWidth={2} />,
          color: 'var(--icon-well-blue)',
          iconColor: 'var(--dash-icon-user)',
          hint: `${overview.system.inactiveUsers} inactive · ${overview.system.unverifiedEmails} unverified`,
        },
        {
          label: 'Active users',
          value: formatCompactNumber(overview.cards.activeUsers.count),
          icon: <UserCheck size={22} strokeWidth={2} />,
          color: 'var(--icon-well-green)',
          iconColor: 'var(--dash-icon-revenue)',
          hint: `Last ${overview.cards.activeUsers.windowDays} days · ${overview.cards.activeUsers.basis.replace(/_/g, ' ')}`,
        },
        {
          label: 'Total projects',
          value: formatCompactNumber(overview.cards.totalProjects),
          icon: <BriefcaseBusiness size={22} strokeWidth={2} />,
          color: 'var(--icon-well-slate)',
          iconColor: 'var(--dash-icon-neutral)',
          hint: `${overview.system.bidsTotal} bids · ${overview.system.applicationsTotal} applications`,
        },
        {
          label: 'Active projects',
          value: formatCompactNumber(overview.cards.activeProjects),
          icon: <FolderKanban size={22} strokeWidth={2} />,
          color: 'var(--icon-well-amber)',
          iconColor: 'var(--dash-icon-warn)',
          hint: `${overview.system.openDisputes} open disputes`,
        },
        {
          label: 'Revenue this month',
          value: formatMinorMoney(overview.cards.revenueThisMonth.amount, overview.currency),
          icon: <CircleDollarSign size={22} strokeWidth={2} />,
          color: 'var(--icon-well-green)',
          iconColor: 'var(--dash-icon-revenue)',
          hint: overview.cards.revenueThisMonth.month,
        },
        {
          label: 'vs last month',
          value:
            overview.cards.revenueChangeVsLastMonth.percentChange === null
              ? overview.cards.revenueChangeVsLastMonth.direction === 'new'
                ? 'New'
                : '—'
              : `${overview.cards.revenueChangeVsLastMonth.direction === 'up' ? '↑' : overview.cards.revenueChangeVsLastMonth.direction === 'down' ? '↓' : ''}${overview.cards.revenueChangeVsLastMonth.percentChange > 0 ? '+' : ''}${overview.cards.revenueChangeVsLastMonth.percentChange}%`,
          icon: <TrendingUp size={22} strokeWidth={2} />,
          color: 'var(--icon-well-sky)',
          iconColor: 'var(--dash-accent)',
          delta: deltaLabel(overview.cards.revenueChangeVsLastMonth),
          hint: `Prior ${formatMinorMoney(
            overview.cards.revenueChangeVsLastMonth.lastMonthAmount,
            overview.currency,
          )}`,
        },
      ]
    : [];

  async function handleExport(kind: 'overview' | 'revenue' | 'users' | 'status' | 'recent') {
    const paths: Record<typeof kind, { path: string; file: string }> = {
      overview: { path: '/admin-stats/overview/export.csv', file: 'overview.csv' },
      revenue: { path: '/admin-stats/charts/revenue/export.csv', file: 'revenue.csv' },
      users: { path: '/admin-stats/charts/users/export.csv', file: 'users.csv' },
      status: { path: '/admin-stats/projects/status/export.csv', file: 'project-status.csv' },
      recent: { path: '/admin-stats/projects/recent/export.csv', file: 'recent-projects.csv' },
    };
    setExporting(kind);
    try {
      await downloadAdminStatsCsv(paths[kind].path, query, paths[kind].file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="admin-stats-dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Admin Stats</h1>
          <p className="page-header-subtitle">
            Full platform pulse — users, revenue, escrow, jobs, and contracts
            {overview ? ` · updated ${new Date(overview.generatedAt).toLocaleTimeString()}` : ''}
          </p>
        </div>

        <div className="dashboard-toolbar">
          <div className="range-pills" role="tablist" aria-label="Date range">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={range === item.id}
                className={range === item.id ? 'range-pill active' : 'range-pill'}
                onClick={() => setRange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            className="currency-select"
            value={currency}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleExport('overview')}
            disabled={!!exporting}
            title="Download overview CSV"
          >
            <FileSpreadsheet size={16} strokeWidth={2} />
            Export
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            title="Refresh now"
            aria-label="Refresh dashboard"
          >
            <RotateCw size={16} strokeWidth={2} />
          </button>

          <ThemeSwitcher />

          <div className="polling-indicator">
            <span className="polling-dot" />
            <span>Live · 30s</span>
          </div>
        </div>
      </div>

      <div className="page-body dashboard-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            <strong>Could not load dashboard:</strong> {error}
          </div>
        )}

        {loading && !overview ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading stats…</span>
          </div>
        ) : (
          <>
            <SummaryCards cards={cards} />
            {overview && <SystemDetailsPanel overview={overview} />}

            <div className="section-heading">
              <h2>Trends</h2>
              <p>Time series for the selected range — missing days are filled with zero</p>
            </div>

            <div className="charts-grid">
              {revenue && <RevenueTrendChart data={revenue} />}
              {users && <UserGrowthChart data={users} />}
            </div>

            <div className="section-heading">
              <h2>Marketplace</h2>
              <p>Freelance project mix and the latest activity</p>
            </div>

            <div className="charts-grid charts-grid-bottom">
              {projects && <ProjectStatusPie data={projects} />}
              {projects && (
                <RecentProjectsTable
                  data={projects}
                  exporting={exporting === 'recent'}
                  onExport={() => void handleExport('recent')}
                />
              )}
            </div>

            <div className="export-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleExport('revenue')}
              >
                <FileSpreadsheet size={14} strokeWidth={2} /> Revenue CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleExport('users')}
              >
                <FileSpreadsheet size={14} strokeWidth={2} /> Users CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleExport('status')}
              >
                <FileSpreadsheet size={14} strokeWidth={2} /> Status CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
