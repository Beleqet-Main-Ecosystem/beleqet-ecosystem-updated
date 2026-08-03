'use client';

import { useState } from 'react';
import { createCampaign } from '@/lib/api';
import { usePromotedEngineTranslation } from '@/i18n/use-promoted-engine-translation';
import type { PromotionCampaign } from '@/types';

interface BoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'JOB' | 'PROPOSAL' | 'GIG';
  targetId: string;
  currency?: string;
  onSuccess?: (campaign: PromotionCampaign) => void;
}

/**
 * "Boost Now" modal — lets an employer or freelancer start a paid visibility
 * campaign for a job, proposal, or gig. Reusable: mount it anywhere a
 * boostable entity is shown (job card, proposal detail, gig listing) and
 * pass the target's type/id as props.
 *
 * Styling follows the existing StepUpModal convention (plain Tailwind
 * overlay, no external modal library).
 */
export function BoostModal({ isOpen, onClose, targetType, targetId, currency = 'ETB', onSuccess }: BoostModalProps) {
  const { t } = usePromotedEngineTranslation();

  const [cpcBid, setCpcBid] = useState('');
  const [dailyBudget, setDailyBudget] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setCpcBid('');
    setDailyBudget('');
    setTotalBudget('');
    setEndAt('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const cpc = Number(cpcBid);
    const daily = Number(dailyBudget);

    if (!cpc || cpc <= 0) {
      setError(t('promotedEngine.cpcBidLabel'));
      return;
    }
    if (!daily || daily < cpc) {
      setError(t('promotedEngine.dailyBudgetLabel'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const campaign = await createCampaign({
        targetType,
        targetId,
        cpcBid: cpc,
        dailyBudget: daily,
        totalBudget: totalBudget ? Number(totalBudget) : undefined,
        currency,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
      });
      onSuccess?.(campaign);
      resetAndClose();
    } catch (err: any) {
      const isInsufficientFunds = err?.response?.status === 400;
      setError(isInsufficientFunds ? t('promotedEngine.insufficientFunds') : t('promotedEngine.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={resetAndClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <button
          onClick={resetAndClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🚀</div>
          <h2 className="text-lg font-semibold text-gray-900">{t('promotedEngine.modalTitle')}</h2>
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('promotedEngine.cpcBidLabel')} ({currency})
            </label>
            <input
              type="number"
              min={1}
              value={cpcBid}
              onChange={(e) => setCpcBid(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('promotedEngine.dailyBudgetLabel')} ({currency})
            </label>
            <input
              type="number"
              min={1}
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('promotedEngine.totalBudgetOptional')}
            </label>
            <input
              type="number"
              min={1}
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('promotedEngine.endDateOptional')}
            </label>
            <input
              type="date"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              disabled={loading}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? t('promotedEngine.submitting') : t('promotedEngine.submit')}
        </button>
      </div>
    </div>
  );
}