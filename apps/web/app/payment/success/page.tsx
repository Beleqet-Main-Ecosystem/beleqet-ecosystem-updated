'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white dark:bg-limeAccent dark:text-obsidian';

type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

/**
 * PayPal's return_url after the payer approves a subscription (see PAYPAL_RETURN_URL).
 * Activation itself happens asynchronously via PayPal's webhook, so this page polls briefly for
 * the subscription to flip to ACTIVE rather than assuming success from the redirect alone.
 */
export default function PaymentSuccessPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<SubscriptionStatus | 'unknown'>('unknown');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= 5 || status === 'ACTIVE') return;
    const timeout = setTimeout(async () => {
      const response = await authenticatedFetch(`${API_URL}/subscriptions/me`).catch(() => null);
      if (response?.ok) {
        const data = await response.json().catch(() => null);
        if (data?.status) setStatus(data.status);
      }
      setAttempts((n) => n + 1);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [attempts, status]);

  const title = 'text-[24px] font-extrabold text-ink-900 dark:text-white';
  const body = 'max-w-md text-[15px] text-ink-700 dark:text-slate-300';
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-3 px-4 text-center">
      {status === 'ACTIVE' ? (
        <>
          <h1 className={title}>{t('checkout.successTitle')}</h1>
          <p className={body}>{t('checkout.successBody')}</p>
        </>
      ) : attempts >= 5 ? (
        <>
          <h1 className={title}>{t('checkout.pendingTitle')}</h1>
          <p className={body}>{t('checkout.pendingBody')}</p>
        </>
      ) : (
        <p role="status" className={body}>{t('checkout.confirming')}</p>
      )}
      <Link href="/employer?tab=plan" className={solid}>{t('checkout.toPlan')}</Link>
    </div>
  );
}
