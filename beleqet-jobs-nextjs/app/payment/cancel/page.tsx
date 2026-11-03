'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white dark:bg-limeAccent dark:text-obsidian';

/** PayPal's cancel_url when the payer backs out of approval (see PAYPAL_CANCEL_URL). */
export default function PaymentCancelPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[24px] font-extrabold text-ink-900 dark:text-white">{t('checkout.cancelTitle')}</h1>
      <p className="max-w-md text-[15px] text-ink-700 dark:text-slate-300">{t('checkout.cancelBody')}</p>
      <Link href="/pricing" className={solid}>{t('checkout.viewPlans')}</Link>
    </div>
  );
}
