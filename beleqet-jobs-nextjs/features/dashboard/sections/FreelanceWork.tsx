'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '../api';
import { card, Empty, Failed, Heading, muted, shortDate, solid } from '../ui';

type Row = { id: string; href: string; title: string; detail: string; status: string };

type MyBid = { id: string; amount: number; status: string; createdAt: string; freelanceJob: { id: string; title: string; contract?: { id: string } | null } };
type MyContract = { id: string; agreedAmount: number; currency: string; status: string; startedAt: string; freelanceJob: { title: string } };

/** My bids and My contracts for freelancer accounts, which the project pages link to. */
export default function FreelanceWork({ kind }: { kind: 'bids' | 'contracts' }) {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setRows(null);
    try {
      if (kind === 'bids') {
        const bids = await apiGet<MyBid[]>('/freelance/my-bids');
        setRows(bids.map((bid) => ({
          id: bid.id,
          href: bid.freelanceJob.contract ? `/freelance/contracts/${bid.freelanceJob.contract.id}` : `/freelance/${bid.freelanceJob.id}`,
          title: bid.freelanceJob.title,
          detail: `ETB ${bid.amount.toLocaleString('en-US')} · ${shortDate(bid.createdAt, locale)}`,
          status: t(`dash.bidStatus.${bid.status}`),
        })));
      } else {
        const contracts = await apiGet<MyContract[]>('/freelance/my-contracts');
        setRows(contracts.map((contract) => ({
          id: contract.id,
          href: `/freelance/contracts/${contract.id}`,
          title: contract.freelanceJob.title,
          detail: `${contract.currency} ${contract.agreedAmount.toLocaleString('en-US')} · ${shortDate(contract.startedAt, locale)}`,
          status: t(`freelance.contract.status.${contract.status}`),
        })));
      }
    } catch {
      setFailed(true);
    }
  }, [kind, locale, t]);
  useEffect(() => void load(), [load]);

  if (failed) return <Failed onRetry={load} />;

  return (
    <>
      <Heading title={t(`dash.tabs.${kind}`)} />
      {rows === null ? (
        <div className="min-h-[40vh]" />
      ) : rows.length === 0 ? (
        <Empty title={t(kind === 'bids' ? 'dash.noBids' : 'dash.noContracts')}>
          <Link href="/freelance" className={`${solid} mt-2`}>{t('freelance.gig.browse')}</Link>
        </Empty>
      ) : (
        rows.map((row) => (
          <Link key={row.id} href={row.href} prefetch={false} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
              <b className="text-ink-900 dark:text-white">{row.title}</b>
              <span className={muted}>{row.detail}</span>
            </span>
            <span className="rounded-md bg-[#F1F4F6] px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{row.status}</span>
          </Link>
        ))
      )}
    </>
  );
}
