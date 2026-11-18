'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, Pager, Segmented, card, input, muted, outline, row, solid, useAction, useResource, type Tone } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatMinor, fullName, safeHttpUrl } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Status = 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'PENDING';
type Transfer = {
  id: string;
  amount: number;
  currency: string;
  status: Status;
  transactionReference: string | null;
  metadata?: { planId?: string; rejectionReason?: string } | null;
  payer?: { firstName: string; lastName: string; email: string } | null;
  createdAt: string;
};
type Plan = { id: string; name: string };
const LIMIT = 20;
const TONE: Record<string, Tone> = { PROCESSING: 'amber', SUCCEEDED: 'green', FAILED: 'red' };

/** Bank-transfer receipts. Approving one starts the plan it pays for. */
export default function PaymentsPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>('PROCESSING');
  const [page, setPage] = useState(1);
  const key = `${status}-${page}`;
  const transfers = useResource((signal) => api<Transfer[]>(`/manual-payment/admin?status=${status}&page=${page}&limit=${LIMIT}`, { signal }), key);
  const plans = useResource((signal) => api<Plan[]>('/plans?includeInactive=true', { signal }), 'plans');
  const action = useAction();
  const [approving, setApproving] = useState<Transfer | null>(null);
  const [rejecting, setRejecting] = useState<{ transfer: Transfer; reason: string } | null>(null);

  const planName = (id?: string) => plans.data?.find((p) => p.id === id)?.name;
  const done = (ok: boolean) => {
    if (!ok) return;
    setApproving(null);
    setRejecting(null);
    transfers.reload();
  };

  async function openReceipt(id: string) {
    try {
      const { url } = await api<{ url: string }>(`/manual-payment/admin/${id}/receipt`);
      const safe = safeHttpUrl(url);
      if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
    } catch (failure) {
      action.setNotice({ kind: 'error', text: failure instanceof Error ? failure.message : String(failure) });
    }
  }

  const rows = transfers.data ?? [];
  return (
    <>
      <Heading title={t('nav.payments')} sub={t('payments.sub')} />
      <Segmented
        label={t('payments.filter')}
        value={status}
        onChange={(value) => { setStatus(value); setPage(1); }}
        options={(['PROCESSING', 'SUCCEEDED', 'FAILED'] as const).map((value) => ({ value, label: t(`payments.status.${value}`) }))}
      />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {transfers.error && <Failed message={transfers.error} onRetry={transfers.reload} />}
        {transfers.loading && <Loading />}
        {transfers.data?.length === 0 && <Empty title={t(`payments.none.${status}`)} />}
        {rows.map((transfer) => {
          const plan = planName(transfer.metadata?.planId);
          return (
            <div key={transfer.id} className={row}>
              <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-ink-900 dark:text-white">{formatMinor(transfer.amount, transfer.currency, locale)}</b>
                  <Badge tone={TONE[transfer.status] ?? 'gray'}>{t(`payments.status.${transfer.status}`)}</Badge>
                  {plan && <Badge>{t('payments.forPlan', { plan })}</Badge>}
                </span>
                <span className="text-ink-700 dark:text-slate-300">{transfer.payer ? `${fullName(transfer.payer)} · ${transfer.payer.email}` : '—'}</span>
                <span className={muted}>{t('payments.reference', { ref: transfer.transactionReference ?? '—' })} · {formatDateTime(transfer.createdAt, locale)}</span>
                {transfer.metadata?.rejectionReason && <span className={muted}>{t('payments.rejectedBecause', { reason: transfer.metadata.rejectionReason })}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={outline} onClick={() => openReceipt(transfer.id)}>{t('payments.receipt')}</button>
                {transfer.status === 'PROCESSING' && (
                  <>
                    <button type="button" disabled={action.busy} className={outline} onClick={() => setRejecting({ transfer, reason: '' })}>{t('payments.reject')}</button>
                    <button type="button" disabled={action.busy} className={solid} onClick={() => setApproving(transfer)}>{t('payments.approve')}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {transfers.data && (rows.length === LIMIT || page > 1) && (
          <Pager page={page} pages={rows.length === LIMIT ? page + 1 : page} total={(page - 1) * LIMIT + rows.length} onPage={setPage} />
        )}
      </section>

      {approving && (
        <Dialog
          title={t('payments.approveTitle', { amount: formatMinor(approving.amount, approving.currency, locale) })}
          text={planName(approving.metadata?.planId) ? t('payments.approvePlanText', { plan: planName(approving.metadata?.planId) ?? '' }) : t('payments.approveText')}
          confirm={t('payments.approve')}
          busy={action.busy}
          onCancel={() => setApproving(null)}
          onConfirm={() => action.run(() => api(`/manual-payment/admin/${approving.id}/approve`, { method: 'PATCH' }), t('payments.approved')).then(done)}
        />
      )}
      {rejecting && (
        <Dialog
          title={t('payments.rejectTitle')}
          confirm={t('payments.reject')}
          tone="danger"
          busy={action.busy}
          disabled={!rejecting.reason.trim()}
          onCancel={() => setRejecting(null)}
          onConfirm={() =>
            action.run(() => api(`/manual-payment/admin/${rejecting.transfer.id}/reject`, { method: 'PATCH', body: { reason: rejecting.reason.trim() } }), t('payments.rejected')).then(done)
          }
        >
          <Field label={t('payments.reason')} hint={t('payments.reasonHint')}>
            <textarea rows={3} value={rejecting.reason} onChange={(e) => setRejecting({ ...rejecting, reason: e.target.value })} className={`${input} py-2`} />
          </Field>
        </Dialog>
      )}
    </>
  );
}
