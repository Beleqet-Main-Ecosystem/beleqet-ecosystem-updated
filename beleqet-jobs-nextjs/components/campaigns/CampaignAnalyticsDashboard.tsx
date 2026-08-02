'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { CurrencyUtil } from '@/lib/currency';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Campaign = {
  id: string;
  targetType: string;
  targetId: string;
  status: string;
  bidModel: string;
  bidAmount: number;
  dailyBudgetCap: number;
  totalBudget: number;
  spentAmount: number;
  dailySpent: number;
  currencyCode: string;
  createdAt: string;
};

type Metrics = {
  campaignId: string;
  status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  spentAmount: number;
  dailySpent: number;
  dailyBudgetCap: number;
  totalBudget: number;
  currencyCode: string;
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-300 ring-1 ring-green-500/30',
  PAUSED: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30',
  EXHAUSTED: 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/30',
  PENDING_PAYMENT: 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30',
  DRAFT: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30',
  COMPLETED: 'bg-slate-500/20 text-slate-200 ring-1 ring-slate-500/30',
};

/**
 * Campaign analytics dashboard: list + selected campaign metrics with
 * spend-vs-budget progress and a lightweight SVG bar chart (no new chart dep).
 */
export default function CampaignAnalyticsDashboard() {
  const { user, ready } = useAuth();
  const { t, locale } = useTranslation();
  const intlLocale = locale === 'am' ? 'am-ET' : 'en-US';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCampaigns = useCallback(async () => {
    const response = await authenticatedFetch(`${API_URL}/campaigns`);
    if (response.ok) {
      const data = (await response.json()) as Campaign[];
      setCampaigns(data);
      if (data.length && !selectedId) setSelectedId(data[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    if (user && ['EMPLOYER', 'ADMIN', 'FREELANCER'].includes(user.role)) {
      loadCampaigns();
    }
  }, [user, loadCampaigns]);

  useEffect(() => {
    if (!selectedId) return;
    authenticatedFetch(`${API_URL}/campaigns/${selectedId}/metrics`).then(async (response) => {
      if (response.ok) setMetrics(await response.json());
    });
  }, [selectedId]);

  const chartBars = useMemo(() => {
    if (!metrics) return [];
    return [
      { label: t('campaigns.impressions'), value: metrics.impressions },
      { label: t('campaigns.clicks'), value: metrics.clicks },
      { label: t('campaigns.conversions'), value: metrics.conversions },
    ];
  }, [metrics, t]);

  const maxBar = Math.max(1, ...chartBars.map((b) => b.value));
  const spendPct = metrics
    ? Math.min(100, Math.round((metrics.spentAmount / Math.max(1, metrics.totalBudget)) * 100))
    : 0;
  const dailyPct = metrics
    ? Math.min(100, Math.round((metrics.dailySpent / Math.max(1, metrics.dailyBudgetCap)) * 100))
    : 0;

  async function pauseOrResume(id: string, status: string) {
    const path = status === 'ACTIVE' ? 'pause' : 'resume';
    const response = await authenticatedFetch(`${API_URL}/campaigns/${id}/${path}`, {
      method: 'PATCH',
    });
    if (response.ok) loadCampaigns();
  }

  if (!ready || !user) {
    return (
      <div className="container-page py-24 text-center text-muted">{t('campaigns.loginRequired')}</div>
    );
  }

  return (
    <div className="min-h-screen bg-pageBg">
      <section className="bg-primary py-12 text-white">
        <div className="container-page flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              {t('campaigns.dashboardEyebrow')}
            </p>
            <h1 className="mt-2 text-4xl font-black text-white">{t('campaigns.dashboardTitle')}</h1>
          </div>
          <Link
            href="/employer"
            className="rounded-full bg-[#d8ff3e] px-5 py-3 text-sm font-bold text-primary"
          >
            {t('campaigns.backToEmployer')}
          </Link>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-ink">
              {t('campaigns.yourCampaigns')}
            </h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted">{t('campaigns.loading')}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted">{t('campaigns.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                      selectedId === c.id
                        ? 'bg-pageBg ring-1 ring-brandGreen/40'
                        : 'hover:bg-pageBg'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-primary">
                        {c.targetType} · {c.bidModel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          STATUS_STYLES[c.status] ?? 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {CurrencyUtil.format(c.spentAmount, c.currencyCode, intlLocale)} /{' '}
                      {CurrencyUtil.format(c.totalBudget, c.currencyCode, intlLocale)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-6">
          {!metrics ? (
            <div className="rounded-2xl border border-border bg-white p-10 text-center text-muted">
              {t('campaigns.selectCampaign')}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-5">
                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      STATUS_STYLES[metrics.status] ?? ''
                    }`}
                  >
                    {metrics.status}
                  </span>
                  <p className="mt-2 text-sm font-medium text-ink">
                    CTR {(metrics.ctr * 100).toFixed(2)}%
                  </p>
                </div>
                {(metrics.status === 'ACTIVE' || metrics.status === 'PAUSED') && (
                  <button
                    type="button"
                    onClick={() => pauseOrResume(metrics.campaignId, metrics.status)}
                    className="rounded-full bg-brandGreen px-4 py-2 text-xs font-bold text-white"
                  >
                    {metrics.status === 'ACTIVE'
                      ? t('campaigns.pause')
                      : t('campaigns.resume')}
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t('campaigns.impressions')} value={metrics.impressions} />
                <StatCard label={t('campaigns.clicks')} value={metrics.clicks} />
                <StatCard label={t('campaigns.conversions')} value={metrics.conversions} />
              </div>

              <div className="rounded-2xl border border-border bg-white p-5">
                <h3 className="text-sm font-black text-primary">{t('campaigns.spendVsBudget')}</h3>
                <Progress
                  label={t('campaigns.totalSpend')}
                  pct={spendPct}
                  detail={`${CurrencyUtil.format(metrics.spentAmount, metrics.currencyCode, intlLocale)} / ${CurrencyUtil.format(metrics.totalBudget, metrics.currencyCode, intlLocale)}`}
                />
                <Progress
                  label={t('campaigns.dailySpend')}
                  pct={dailyPct}
                  detail={`${CurrencyUtil.format(metrics.dailySpent, metrics.currencyCode, intlLocale)} / ${CurrencyUtil.format(metrics.dailyBudgetCap, metrics.currencyCode, intlLocale)}`}
                />
              </div>

              <div className="rounded-2xl border border-border bg-white p-5">
                <h3 className="mb-4 text-sm font-black text-primary">{t('campaigns.eventsChart')}</h3>
                <svg
                  viewBox="0 0 360 160"
                  className="h-40 w-full"
                  role="img"
                  aria-label={t('campaigns.eventsChart')}
                >
                  {chartBars.map((bar, index) => {
                    const barWidth = 70;
                    const gap = 40;
                    const x = 40 + index * (barWidth + gap);
                    const height = (bar.value / maxBar) * 110;
                    const y = 130 - height;
                    return (
                      <g key={bar.label}>
                        <rect x={x} y={y} width={barWidth} height={height} rx={8} fill="#22c55e" />
                        <text
                          x={x + barWidth / 2}
                          y={148}
                          textAnchor="middle"
                          fontSize="11"
                          fill="currentColor"
                          className="text-muted"
                        >
                          {bar.label}
                        </text>
                        <text
                          x={x + barWidth / 2}
                          y={y - 6}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="currentColor"
                          className="text-ink"
                        >
                          {bar.value}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="text-3xl font-black text-primary">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Progress({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs font-bold text-ink">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-pageBg">
        <div className="h-full rounded-full bg-brandGreen transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
