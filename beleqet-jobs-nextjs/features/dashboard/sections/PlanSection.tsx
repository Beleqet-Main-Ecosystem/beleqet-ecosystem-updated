'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend } from '../api';
import { card, Confirm, Heading, muted, outline, shortDate, solid } from '../ui';
import BankTransfer from './BankTransfer';

type Subscription = {
  id: string;
  planId?: string;
  provider?: string | null;
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

  // Back from Chapa: watch the payment until it is confirmed, then show the plan it started.
  const paymentId = useSearchParams().get('payment');
  const [paymentState, setPaymentState] = useState<'' | 'checking' | 'paid' | 'failed' | 'slow'>(paymentId ? 'checking' : '');

  const load = useCallback(() => {
    apiGet<Subscription | null>('/subscriptions/me').then(setSubscription).catch(() => setSubscription(null));
    apiGet<Quota>('/jobs/my/quota').then(setQuota).catch(() => setQuota(null));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    if (!paymentId) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const payment = await apiGet<{ status: string }>(`/subscriptions/payments/${paymentId}`).catch(() => null);
      if (payment?.status === 'SUCCEEDED' || payment?.status === 'FAILED' || tries >= 20) {
        clearInterval(timer);
        setPaymentState(payment?.status === 'SUCCEEDED' ? 'paid' : payment?.status === 'FAILED' ? 'failed' : 'slow');
        load();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [paymentId, load]);

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
      {paymentState && (
        <p role="status" className={`rounded-lg p-3.5 text-sm font-semibold ${paymentState === 'failed' ? 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-red-900/20 dark:text-red-200' : 'bg-[#F1F7EC] text-forest dark:bg-limeAccent/10 dark:text-limeAccent'}`}>
          {t(`emp.payment.${paymentState}`)}
        </p>
      )}
      <section className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <span className="flex flex-col gap-1">
          <b className="text-xl text-ink-900 dark:text-white">{plan?.name ?? 'Free'}</b>
          {plan?.priceAmount ? <span className="text-sm text-ink-700 dark:text-slate-300">{plan.currency} {(plan.priceAmount / 100).toLocaleString('en-US')} / {t('pricing.month')}</span> : null}
          {subscription?.currentPeriodEnd && (
            // Paypal renews by itself; a Chapa or bank-transfer plan runs until the paid period ends.
            <span className={muted}>
              {t(active && subscription.provider === 'PAYPAL' ? 'dash.renews' : active ? 'emp.paidUntil' : 'dash.ends').replace('{date}', shortDate(subscription.currentPeriodEnd, locale))}
            </span>
          )}
        </span>
        <span className="flex flex-wrap gap-2">
          {active && subscription.provider !== 'PAYPAL' && subscription.planId && plan?.priceAmount ? (
            <Link href={`/checkout?planId=${subscription.planId}&method=CHAPA`} className={solid}>{t('emp.payNextPeriod')}</Link>
          ) : null}
          <Link href="/pricing" className={active && subscription.provider !== 'PAYPAL' ? outline : solid}>{t('emp.changePlan')}</Link>
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
      <BankTransfer />
      {cancelling && (
        <Confirm title={t('dash.cancelTitle')} text={t('dash.cancelText')} cancel={t('dash.keepPlan')} confirm={t('dash.cancelPlan')} busy={busy} onCancel={() => setCancelling(false)} onConfirm={cancel} />
      )}
    </>
  );
}
