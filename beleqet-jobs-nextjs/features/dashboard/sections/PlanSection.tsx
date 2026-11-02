'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend } from '../api';
import { card, Confirm, Heading, muted, outline, shortDate, solid } from '../ui';

type Subscription = {
  id: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
  plan?: { name?: string; priceAmount?: number; currency?: string; features?: { maxJobPosts?: number } } | null;
};

type Quota = { used: number; max: number | null };

export default function PlanSection() {
  const { t, locale } = useTranslation();
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quota, setQuota] = useState<Quota | null>(null);

  const load = useCallback(() => {
    apiGet<Subscription | null>('/subscriptions/me').then(setSubscription).catch(() => setSubscription(null));
    apiGet<Quota>('/jobs/my/quota').then(setQuota).catch(() => setQuota(null));
  }, []);
  useEffect(load, [load]);

  if (subscription === undefined) return <div className="min-h-[40vh]" />;

  const plan = subscription?.plan;
  const used = quota?.used ?? 0;
  const maxPosts = quota?.max ?? null;
  const limited = maxPosts !== null;
  const percent = limited && maxPosts ? Math.min(100, Math.round((used / maxPosts) * 100)) : 0;
  const active = subscription && !subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE';

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await apiSend('POST', `/subscriptions/${subscription!.id}/cancel`);
      setSubscription({ ...subscription!, cancelAtPeriodEnd: true });
    } catch {
      setError(t('freelance.gig.actionFailed'));
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  }

  return (
    <>
      <Heading title={t('emp.tabs.plan')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <span className="flex flex-col gap-1">
          <b className="text-xl text-ink-900 dark:text-white">{plan?.name ?? 'Free'}</b>
          {plan?.priceAmount ? <span className="text-sm text-ink-700 dark:text-slate-300">{plan.currency} {(plan.priceAmount / 100).toLocaleString('en-US')} / {t('pricing.month')}</span> : null}
          {subscription?.currentPeriodEnd && (
            <span className={muted}>{t(active ? 'dash.renews' : 'dash.ends').replace('{date}', shortDate(subscription.currentPeriodEnd, locale))}</span>
          )}
        </span>
        <span className="flex flex-wrap gap-2">
          <Link href="/pricing" className={solid}>{t('emp.changePlan')}</Link>
          {active && <button type="button" onClick={() => setCancelling(true)} className={outline}>{t('dash.cancelPlan')}</button>}
        </span>
      </section>
      <section aria-labelledby="usage-h" className={`${card} flex flex-col gap-2`}>
        <h2 id="usage-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('emp.usage')}</h2>
        <span className="flex justify-between gap-3 text-sm">
          <span className="text-ink-500 dark:text-slate-400">{t('pricing.rowPosts')}</span>
          <b className="text-ink-900 dark:text-white">{limited ? t('postJob.postsUsed').replace('{used}', String(used)).replace('{max}', String(maxPosts)) : used}</b>
        </span>
        {limited && (
          <div role="progressbar" aria-label={t('pricing.rowPosts')} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-[#F1F4F6] dark:bg-slate-800">
            <div className="h-2 bg-forest dark:bg-limeAccent" style={{ width: `${percent}%` }} />
          </div>
        )}
      </section>
      {cancelling && (
        <Confirm title={t('dash.cancelTitle')} text={t('dash.cancelText')} cancel={t('dash.keepPlan')} confirm={t('dash.cancelPlan')} busy={busy} onCancel={() => setCancelling(false)} onConfirm={cancel} />
      )}
    </>
  );
}
