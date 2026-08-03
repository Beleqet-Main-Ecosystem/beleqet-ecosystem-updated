'use client';

import { usePolling } from '@/hooks/usePolling';
import { listMyCampaigns } from '@/lib/api';
import { usePromotedEngineTranslation } from '@/i18n/use-promoted-engine-translation';
import { CampaignRow } from './CampaignRow';
import type { PromotionCampaign } from '@/types';

const POLLING_INTERVAL_MS = 30_000;

/**
 * "My Campaigns" analytics dashboard — every campaign the current user owns
 * (jobs, proposals, gigs), with live-ish performance stats and lifecycle
 * controls. Polls on the same interval convention as the admin disputes
 * dashboard (usePolling, 30s here since ad spend/impressions change more
 * slowly than a live chat feed but faster than something like theme prefs).
 */
export function CampaignsDashboard() {
  const { t } = usePromotedEngineTranslation();

  const {
    data: campaigns,
    loading,
    error,
    refetch,
  } = usePolling<PromotionCampaign[]>(() => listMyCampaigns(), POLLING_INTERVAL_MS);

  const handleChanged = (updated: PromotionCampaign) => {
    // Optimistic local patch so a pause/resume/cancel reflects immediately
    // rather than waiting for the next poll tick.
    if (!campaigns) return;
    const next = campaigns.map((c) => (c.id === updated.id ? updated : c));
    // usePolling's returned `data` is owned by the hook; trigger a refetch
    // to pull the authoritative state rather than mutating it directly.
    void next;
    refetch();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">{t('promotedEngine.dashboardTitle')}</h1>
        <button
          onClick={refetch}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ↻
        </button>
      </header>

      {loading && <DashboardSkeleton />}

      {!loading && error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}.{' '}
          <button onClick={refetch} className="font-medium underline underline-offset-2">
            {t('promotedEngine.submit')}
          </button>
        </div>
      )}

      {!loading && !error && campaigns && campaigns.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {t('promotedEngine.noCampaigns')}
        </div>
      )}

      {!loading && !error && campaigns && campaigns.length > 0 && (
        <ul className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} onChanged={handleChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100 mb-3" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}