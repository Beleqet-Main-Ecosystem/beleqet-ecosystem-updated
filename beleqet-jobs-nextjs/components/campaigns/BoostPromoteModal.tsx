'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { CurrencyUtil } from '@/lib/currency';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type BoostTargetType = 'JOB' | 'GIG' | 'PROPOSAL';

type Props = {
  targetType: BoostTargetType;
  targetId: string;
  targetTitle?: string;
  /** Compact trigger for table rows */
  compact?: boolean;
};

const CURRENCIES = ['ETB', 'USD', 'EUR'] as const;

/**
 * "Boost / Promote Now" modal: budget + bid inputs, currency selector,
 * and a live estimated reach/cost preview.
 */
export default function BoostPromoteModal({
  targetType,
  targetId,
  targetTitle,
  compact = false,
}: Props) {
  const { t, locale } = useTranslation();
  const intlLocale = locale === 'am' ? 'am-ET' : 'en-US';

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('ETB');
  const [bidModel, setBidModel] = useState<'CPC' | 'CPM'>('CPC');
  const [bidMajor, setBidMajor] = useState('5');
  const [dailyMajor, setDailyMajor] = useState('100');
  const [totalMajor, setTotalMajor] = useState('500');

  const preview = useMemo(() => {
    const bid = Number(bidMajor) || 0;
    const daily = Number(dailyMajor) || 0;
    const total = Number(totalMajor) || 0;
    const bidUnits = CurrencyUtil.toSmallestUnit(bid);
    const dailyUnits = CurrencyUtil.toSmallestUnit(daily);
    const totalUnits = CurrencyUtil.toSmallestUnit(total);

    const eventsPerDay = bid > 0 ? Math.floor(daily / bid) : 0;
    const estimatedReach =
      bidModel === 'CPM' ? eventsPerDay * 1000 : Math.max(eventsPerDay * 8, eventsPerDay);
    const days = daily > 0 ? Math.floor(total / daily) : 0;

    return {
      bidUnits,
      dailyUnits,
      totalUnits,
      estimatedReach,
      estimatedDays: days,
                  dailyFormatted: CurrencyUtil.format(dailyUnits, currency, intlLocale),
      totalFormatted: CurrencyUtil.format(totalUnits, currency, intlLocale),
      bidFormatted: CurrencyUtil.format(bidUnits, currency, intlLocale),
    };
  }, [bidMajor, dailyMajor, totalMajor, bidModel, currency, intlLocale]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (preview.dailyUnits > preview.totalUnits) {
        throw new Error(t('campaigns.errorDailyExceedsTotal'));
      }
      const response = await authenticatedFetch(`${API_URL}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          bidModel,
          bidAmount: preview.bidUnits,
          dailyBudgetCap: preview.dailyUnits,
          totalBudget: preview.totalUnits,
          currencyCode: currency,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || t('campaigns.errorCreate'),
        );
      }
      const status = data.campaign?.status ?? data.status;
      setSuccess(
        status === 'PENDING_PAYMENT'
          ? t('campaigns.successPendingPayment')
          : t('campaigns.successActive'),
      );
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaigns.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('');
          setSuccess('');
          setOpen(true);
        }}
        className={
          compact
            ? 'inline-flex items-center gap-1 text-xs font-bold text-brandGreen'
            : 'inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white'
        }
      >
        <Megaphone className="h-4 w-4" />
        {t('campaigns.boostNow')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('campaigns.boostTitle')}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-brandGreen">
                  {t('campaigns.boostEyebrow')}
                </p>
                <h2 className="mt-1 text-xl font-black text-primary">{t('campaigns.boostTitle')}</h2>
                {targetTitle && <p className="mt-1 text-sm text-muted">{targetTitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-muted hover:bg-pageBg"
                aria-label={t('campaigns.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-xs font-bold uppercase text-muted">
                {t('campaigns.bidModel')}
                <select
                  value={bidModel}
                  onChange={(e) => setBidModel(e.target.value as 'CPC' | 'CPM')}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold text-ink"
                >
                  <option value="CPC">{t('campaigns.bidModelCpc')}</option>
                  <option value="CPM">{t('campaigns.bidModelCpm')}</option>
                </select>
              </label>

              <label className="block text-xs font-bold uppercase text-muted">
                {t('campaigns.currency')}
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold text-ink"
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-bold uppercase text-muted">
                  {t('campaigns.bidRate')}
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={bidMajor}
                    onChange={(e) => setBidMajor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="block text-xs font-bold uppercase text-muted">
                  {t('campaigns.dailyBudget')}
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={dailyMajor}
                    onChange={(e) => setDailyMajor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="block text-xs font-bold uppercase text-muted">
                  {t('campaigns.totalBudget')}
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={totalMajor}
                    onChange={(e) => setTotalMajor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-[#f7f5ef] p-4 text-sm">
                <p className="text-xs font-extrabold uppercase text-muted">
                  {t('campaigns.livePreview')}
                </p>
                <ul className="mt-3 space-y-1.5 text-ink">
                  <li>
                    {t('campaigns.estReach')}:{' '}
                    <strong>{preview.estimatedReach.toLocaleString(intlLocale)}</strong>
                  </li>
                  <li>
                    {t('campaigns.estDays')}: <strong>{preview.estimatedDays}</strong>
                  </li>
                  <li>
                    {t('campaigns.dailyCost')}: <strong>{preview.dailyFormatted}</strong>
                  </li>
                  <li>
                    {t('campaigns.totalCost')}: <strong>{preview.totalFormatted}</strong>
                  </li>
                  <li>
                    {t('campaigns.bidRate')}: <strong>{preview.bidFormatted}</strong>
                  </li>
                </ul>
              </div>

              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              {success && <p className="text-sm font-semibold text-brandGreen">{success}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full border border-border px-4 py-3 text-sm font-bold"
                >
                  {t('campaigns.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-full bg-brandGreen px-4 py-3 text-sm font-bold text-primary disabled:opacity-60"
                >
                  {submitting ? t('campaigns.submitting') : t('campaigns.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
