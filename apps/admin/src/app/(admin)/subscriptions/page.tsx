'use client';

import { useState } from 'react';
import { Badge, Empty, Failed, Heading, Loading, Pager, Segmented, card, muted, row, useResource, type Tone } from '@/components/ui';
import { api, query } from '@/lib/api';
import { formatDate, formatMinor, fullName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Status = '' | 'ACTIVE' | 'PENDING' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
type Subscription = {
  id: string;
  status: Exclude<Status, ''>;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: string | null;
  plan: { name: string; priceAmount: number; currency: string };
  user: { firstName: string; lastName: string; email: string };
};
const LIMIT = 25;
const TONE: Record<string, Tone> = { ACTIVE: 'green', PENDING: 'amber', PAST_DUE: 'red', CANCELLED: 'gray', EXPIRED: 'gray' };

/** Who is on which plan, how they pay, and when it ends or renews. */
export default function SubscriptionsPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>('ACTIVE');
  const [page, setPage] = useState(1);
  const subs = useResource((signal) => api<Subscription[]>(`/subscriptions${query({ status })}`, { signal }), status);
  const all = subs.data ?? [];
  const shown = all.slice((page - 1) * LIMIT, page * LIMIT);

  return (
    <>
      <Heading title={t('nav.subscriptions')} sub={t('subscriptions.sub')} />
      <Segmented
        label={t('subscriptions.filter')}
        value={status}
        onChange={(value) => { setStatus(value); setPage(1); }}
        options={(['ACTIVE', 'PENDING', 'PAST_DUE', 'CANCELLED', 'EXPIRED', ''] as const).map((value) => ({ value, label: t(`subscriptions.status.${value || 'ALL'}`) }))}
      />
      <section className={card}>
        {subs.error && <Failed message={subs.error} onRetry={subs.reload} />}
        {subs.loading && <Loading />}
        {subs.data?.length === 0 && <Empty title={t('subscriptions.none')} />}
        {shown.map((sub) => (
          <div key={sub.id} className={row}>
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5 text-sm">
              <b className="text-ink-900 dark:text-white">{fullName(sub.user)}</b>
              <span className={`${muted} break-all`}>{sub.user.email}</span>
            </div>
            <div className="flex min-w-[180px] flex-col gap-0.5 text-sm">
              <span className="text-ink-900 dark:text-white">{sub.plan.name} · {formatMinor(sub.plan.priceAmount, sub.plan.currency, locale)}</span>
              <span className={muted}>{t(`subscriptions.provider.${sub.provider ?? 'NONE'}`)}</span>
            </div>
            <div className="flex min-w-[180px] flex-col items-start gap-1 text-sm">
              <Badge tone={TONE[sub.status]}>{t(`subscriptions.status.${sub.status}`)}</Badge>
              <span className={muted}>
                {sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd
                  ? t('subscriptions.renews', { date: formatDate(sub.currentPeriodEnd, locale) })
                  : t('subscriptions.ends', { date: formatDate(sub.currentPeriodEnd, locale) })}
              </span>
            </div>
          </div>
        ))}
        {subs.data && <Pager page={page} pages={Math.max(1, Math.ceil(all.length / LIMIT))} total={all.length} onPage={setPage} />}
      </section>
    </>
  );
}
