'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white dark:bg-limeAccent dark:text-obsidian';
const option = 'flex w-full flex-col items-start gap-1 rounded-xl border border-ink-200 bg-white p-4 text-left hover:border-forest dark:border-white/15 dark:bg-white/5 dark:hover:border-limeAccent';

type Method = 'CHAPA' | 'PAYPAL';

/**
 * Starts a plan checkout and sends the browser to the payment page. Chapa (Telebirr, CBE Birr,
 * banks, cards) pays one period at a time; PayPal renews automatically. `?method=` skips the choice.
 */
function CheckoutInner() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const params = useSearchParams();
  const planId = params.get('planId');
  const preset = params.get('method');
  const [method, setMethod] = useState<Method | null>(preset === 'CHAPA' || preset === 'PAYPAL' ? preset : null);
  const [error, setError] = useState('');
  const started = useRef(false);

  async function start(chosen: Method) {
    setMethod(chosen);
    setError('');
    try {
      const response = await authenticatedFetch(`${API_URL}/subscriptions/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, method: chosen }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (response.status === 404) setError(t('checkout.noPlan'));
      else if (response.status === 409) setError(t(chosen === 'PAYPAL' ? 'checkout.alreadySubscribed' : 'checkout.paypalRenewing'));
      else if (response.status === 400 && chosen === 'PAYPAL') setError(t('checkout.paypalUnavailable'));
      else setError(t('checkout.failed'));
    } catch {
      setError(t('checkout.failed'));
    }
  }

  useEffect(() => {
    if (!ready || !user || !planId || !method || started.current) return;
    started.current = true;
    void start(method);
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
  if (!method) {
    return (
      <div className={wrap}>
        <h1 className="text-[22px] font-extrabold text-ink-900 dark:text-white">{t('checkout.chooseTitle')}</h1>
        <button type="button" onClick={() => start('CHAPA')} className={option}>
          <span className="text-[15px] font-bold text-ink-900 dark:text-white">{t('checkout.chapaTitle')}</span>
          <span className="text-sm text-ink-700 dark:text-slate-300">{t('checkout.chapaBody')}</span>
        </button>
        <button type="button" onClick={() => start('PAYPAL')} className={option}>
          <span className="text-[15px] font-bold text-ink-900 dark:text-white">{t('checkout.paypalTitle')}</span>
          <span className="text-sm text-ink-700 dark:text-slate-300">{t('checkout.paypalBody')}</span>
        </button>
        <Link href="/employer?tab=plan" className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('checkout.bankInstead')}</Link>
      </div>
    );
  }
  return (
    <div className={wrap}>
      {error ? (
        <>
          <p role="alert" className="text-[15px] font-semibold text-red-700 dark:text-red-300">{error}</p>
          <button type="button" onClick={() => start(method)} className={solid}>{t('freelance.retry')}</button>
          <button type="button" onClick={() => { setError(''); setMethod(null); }} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('checkout.otherMethod')}</button>
        </>
      ) : (
        <p role="status" className="text-[15px] text-ink-700 dark:text-slate-300">{t(method === 'PAYPAL' ? 'checkout.redirectingPaypal' : 'checkout.redirecting')}</p>
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
