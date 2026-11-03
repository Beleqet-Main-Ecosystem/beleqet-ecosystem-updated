'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white dark:bg-limeAccent dark:text-obsidian';

/** Starts a Chapa checkout for the chosen plan and sends the browser to it. */
function CheckoutInner() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const planId = useSearchParams().get('planId');
  const [error, setError] = useState('');
  const started = useRef(false);

  async function start() {
    setError('');
    try {
      const response = await authenticatedFetch(`${API_URL}/subscriptions/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(t(response.status === 404 ? 'checkout.noPlan' : 'checkout.failed'));
    } catch {
      setError(t('checkout.failed'));
    }
  }

  useEffect(() => {
    if (!ready || !user || !planId || started.current) return;
    started.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, planId]);

  const wrap = 'mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-3 px-4 text-center';
  if (!planId) {
    return (
      <div className={wrap}>
        <p className="text-[15px] text-ink-700 dark:text-slate-300">{t('checkout.noPlan')}</p>
        <Link href="/pricing" className={solid}>{t('checkout.viewPlans')}</Link>
      </div>
    );
  }
  if (!ready) return <div className="min-h-[60vh]" />;
  if (!user) {
    return (
      <div className={wrap}>
        <p className="text-[15px] text-ink-700 dark:text-slate-300">{t('checkout.signIn')}</p>
        <Link href={`/login?next=${encodeURIComponent(`/checkout?planId=${planId}`)}`} className={solid}>{t('postJob.signIn')}</Link>
      </div>
    );
  }
  return (
    <div className={wrap}>
      {error ? (
        <>
          <p role="alert" className="text-[15px] font-semibold text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={start} className={solid}>{t('freelance.retry')}</button>
          <Link href="/employer?tab=plan" className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('checkout.bankInstead')}</Link>
        </>
      ) : (
        <p role="status" className="text-[15px] text-ink-700 dark:text-slate-300">{t('checkout.redirecting')}</p>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <CheckoutInner />
    </Suspense>
  );
}
