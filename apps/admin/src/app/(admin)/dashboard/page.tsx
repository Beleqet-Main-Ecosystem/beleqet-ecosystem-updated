'use client';

import { useState } from 'react';
import Link from 'next/link';
import ColumnChart from '@/components/ColumnChart';
import { Failed, Heading, Loading, Segmented, card, muted, useResource } from '@/components/ui';
import { api } from '@/lib/api';
import { formatMinor, formatNumber } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Range = '7d' | '30d' | '12m';
type Overview = {
  currency: string;
  cards: {
    totalUsers: number;
    activeUsers: { count: number; windowDays: number };
    totalProjects: number;
    activeProjects: number;
    revenueThisMonth: { amount: number };
    revenueChangeVsLastMonth: { percentChange: number | null; direction: 'up' | 'down' | 'flat' };
  };
  system: { usersByRole: { role: string; count: number }[]; unverifiedEmails: number; inactiveUsers: number };
};
type Series<K extends string> = { series: ({ date: string } & Record<K, number>)[] };
type Waiting = { reports: number; companies: number; disputes: number; payments: number };

async function loadWaiting(signal: AbortSignal): Promise<Waiting> {
  const count = (path: string, keep: (row: Record<string, unknown>) => boolean = () => true) =>
    api<Record<string, unknown>[]>(path, { signal }).then((rows) => rows.filter(keep).length).catch(() => 0);
  const [reports, companies, disputes, payments] = await Promise.all([
    count('/reports/admin'),
    count('/admin/companies/verification'),
    count('/admin/escrow/disputes', (row) => !row.resolvedAt),
    count('/manual-payment/admin?status=PROCESSING&limit=100'),
  ]);
  return { reports, companies, disputes, payments };
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [range, setRange] = useState<Range>('30d');
  const stats = useResource(
    (signal) =>
      Promise.all([
        api<Overview>(`/admin-stats/overview?range=${range}`, { signal }),
        api<Series<'registrations'>>(`/admin-stats/charts/users?range=${range}`, { signal }),
        api<Series<'revenue'>>(`/admin-stats/charts/revenue?range=${range}`, { signal }),
      ]),
    range,
  );
  const waiting = useResource(loadWaiting, 'waiting');

  const label = (date: string) =>
    new Date(date).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', range === '12m' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });

  return (
    <>
      <Heading title={t('dashboard.title')} sub={t('dashboard.sub')}>
        <Segmented
          label={t('dashboard.range')}
          value={range}
          onChange={setRange}
          options={(['7d', '30d', '12m'] as const).map((value) => ({ value, label: t(`dashboard.ranges.${value}`) }))}
        />
      </Heading>

      <section aria-labelledby="waiting-h" className={card}>
        <h2 id="waiting-h" className="mb-3 font-bold text-ink-900 dark:text-white">{t('dashboard.waiting')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['reports', 'companies', 'disputes', 'payments'] as const).map((key) => {
            const value = waiting.data?.[key];
            return (
              <Link key={key} href={`/${key}`} className="flex flex-col gap-1 rounded-lg border border-ink-200 p-3 hover:border-forest dark:border-slate-800 dark:hover:border-limeAccent">
                <span className="text-2xl font-extrabold tabular-nums text-ink-900 dark:text-white">{value ?? '—'}</span>
                <span className={muted}>{t(`dashboard.queue.${key}`)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {stats.error && <div className={card}><Failed message={stats.error} onRetry={stats.reload} /></div>}
      {stats.loading && <div className={card}><Loading /></div>}
      {stats.data && (() => {
        const [overview, users, revenue] = stats.data;
        const { cards, currency } = overview;
        const change = cards.revenueChangeVsLastMonth;
        const tiles = [
          { label: t('dashboard.tiles.users'), value: formatNumber(cards.totalUsers, locale), note: t('dashboard.tiles.usersNote', { count: formatNumber(overview.system.unverifiedEmails, locale) }) },
          { label: t('dashboard.tiles.active', { days: cards.activeUsers.windowDays }), value: formatNumber(cards.activeUsers.count, locale) },
          { label: t('dashboard.tiles.projects'), value: formatNumber(cards.activeProjects, locale), note: t('dashboard.tiles.projectsNote', { total: formatNumber(cards.totalProjects, locale) }) },
          {
            label: t('dashboard.tiles.revenue'),
            value: formatMinor(cards.revenueThisMonth.amount, currency, locale),
            note: change.percentChange === null ? t('dashboard.tiles.noComparison') : t(`dashboard.tiles.change.${change.direction}`, { percent: Math.abs(change.percentChange).toFixed(0) }),
          },
        ];
        const roleTop = Math.max(1, ...overview.system.usersByRole.map((r) => r.count));
        return (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map((tile) => (
                <div key={tile.label} className={`${card} flex flex-col gap-1`}>
                  <span className={muted}>{tile.label}</span>
                  <b className="text-2xl font-extrabold tabular-nums text-ink-900 dark:text-white">{tile.value}</b>
                  {tile.note && <span className={muted}>{tile.note}</span>}
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className={card}>
                <ColumnChart
                  title={t('dashboard.signUps')}
                  points={users.series.map((p) => ({ label: label(p.date), value: p.registrations }))}
                  format={(v) => formatNumber(Math.round(v), locale)}
                />
              </section>
              <section className={card}>
                <ColumnChart
                  title={t('dashboard.revenue', { currency })}
                  points={revenue.series.map((p) => ({ label: label(p.date), value: p.revenue / 100 }))}
                  format={(v) => formatNumber(Math.round(v), locale)}
                />
              </section>
            </div>

            <section aria-labelledby="roles-h" className={card}>
              <h2 id="roles-h" className="mb-3 font-bold text-ink-900 dark:text-white">{t('dashboard.byRole')}</h2>
              <ul className="flex flex-col gap-2.5">
                {overview.system.usersByRole.map(({ role, count }) => (
                  <li key={role} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[140px_1fr_auto]">
                    <span className="text-ink-700 dark:text-slate-300">{t(`roles.${role}`)}</span>
                    <span className="h-2.5 rounded-full bg-ink-100 dark:bg-slate-800">
                      <span className="block h-full rounded-full bg-forest dark:bg-brand-500" style={{ width: `${(count / roleTop) * 100}%` }} />
                    </span>
                    <b className="tabular-nums text-ink-900 dark:text-white">{formatNumber(count, locale)}</b>
                  </li>
                ))}
              </ul>
            </section>
          </>
        );
      })()}
    </>
  );
}
