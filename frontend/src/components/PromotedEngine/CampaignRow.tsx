'use client';

import { useState } from 'react';
import { updateCampaignStatus } from '@/lib/api';
import { usePromotedEngineTranslation } from '@/i18n/use-promoted-engine-translation';
import type { PromotionCampaign } from '@/types';

interface CampaignRowProps {
  campaign: PromotionCampaign;
  onChanged: (updated: PromotionCampaign) => void;
}

/** Maps a campaign status to a small color-coded badge — mirrors the
 *  "not red for a non-error state" convention used in the Matchmaker's ScoreRing. */
function statusBadgeClass(status: PromotionCampaign['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700';
    case 'PAUSED':
      return 'bg-amber-50 text-amber-700';
    case 'EXHAUSTED':
      return 'bg-amber-50 text-amber-700';
    case 'COMPLETED':
      return 'bg-slate-100 text-slate-600';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-500';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function CampaignRow({ campaign, onChanged }: CampaignRowProps) {
  const { t } = usePromotedEngineTranslation();
  const [loading, setLoading] = useState(false);

  const ctr = campaign.impressions === 0 ? 0 : (campaign.clicks / campaign.impressions) * 100;

  const handlePause = async () => {
    setLoading(true);
    try {
      onChanged(await updateCampaignStatus(campaign.id, 'PAUSED'));
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      onChanged(await updateCampaignStatus(campaign.id, 'ACTIVE'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('promotedEngine.confirmCancel'))) return;
    setLoading(true);
    try {
      onChanged(await updateCampaignStatus(campaign.id, 'CANCELLED'));
    } finally {
      setLoading(false);
    }
  };

  const canPause = campaign.status === 'ACTIVE';
  const canResume = campaign.status === 'PAUSED';
  const canCancel = campaign.status === 'ACTIVE' || campaign.status === 'PAUSED' || campaign.status === 'EXHAUSTED';

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {campaign.targetType} · {campaign.targetId.slice(0, 8)}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(campaign.status)}`}>
          {campaign.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4 text-center">
        <div>
          <p className="text-sm font-semibold text-slate-900 tabular-nums">{campaign.impressions}</p>
          <p className="text-xs text-slate-500">{t('promotedEngine.impressions')}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 tabular-nums">{campaign.clicks}</p>
          <p className="text-xs text-slate-500">{t('promotedEngine.clicks')}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 tabular-nums">{ctr.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">{t('promotedEngine.ctr')}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 tabular-nums">
            {campaign.spentTotal} {campaign.currency}
          </p>
          <p className="text-xs text-slate-500">{t('promotedEngine.spent')}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {canPause && (
          <button
            onClick={handlePause}
            disabled={loading}
            className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('promotedEngine.pause')}
          </button>
        )}
        {canResume && (
          <button
            onClick={handleResume}
            disabled={loading}
            className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('promotedEngine.resume')}
          </button>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {t('promotedEngine.cancelCampaign')}
          </button>
        )}
      </div>
    </li>
  );
}
