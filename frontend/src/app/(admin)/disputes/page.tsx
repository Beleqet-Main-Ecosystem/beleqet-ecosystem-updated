'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, Segmented, card, input, muted, outline, row, solid, useAction, useResource } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatMajor, fullName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Person = { firstName: string; lastName: string; email?: string };
type Outcome = 'REFUND' | 'RELEASE' | 'SPLIT';
type Dispute = {
  id: string;
  reason: string;
  evidenceUrls: string[];
  resolution: string | null;
  resolvedAt: string | null;
  outcome: Outcome | null;
  clientAmount: number | null;
  freelancerAmount: number | null;
  createdAt: string;
  raisedById: string;
  contract: { id: string; agreedAmount: number; currency?: string; clientId: string; freelanceJob: { title: string }; client: Person; freelancer: Person };
};
type Message = { id: string; content: string; createdAt: string; senderId: string; sender?: Person };
type Settle = { dispute: Dispute; outcome: Outcome; share: string; resolution: string };

/**
 * Disputes on escrowed projects. Settling moves what escrow still holds: back to the client,
 * to the freelancer (less the platform fee), or split. It can't be undone.
 */
export default function DisputesPage() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<'open' | 'settled'>('open');
  const disputes = useResource((signal) => api<Dispute[]>('/admin/escrow/disputes', { signal }), 'disputes');
  const action = useAction();
  const [settling, setSettling] = useState<Settle | null>(null);
  const [reading, setReading] = useState<string | null>(null);

  const rows = (disputes.data ?? []).filter((d) => (view === 'open' ? !d.resolvedAt : d.resolvedAt));
  const money = (amount: number, d: Dispute) => formatMajor(amount, d.contract.currency ?? 'ETB', locale);

  async function settle() {
    if (!settling) return;
    const { dispute, outcome, share, resolution } = settling;
    const ok = await action.run(
      () =>
        api(`/admin/disputes/${dispute.id}/resolve`, {
          method: 'PATCH',
          body: { outcome, resolution: resolution.trim(), freelancerAmount: outcome === 'SPLIT' ? Number(share) : undefined },
        }),
      t('disputes.settled'),
    );
    if (ok) {
      setSettling(null);
      disputes.reload();
    }
  }

  const shareValid = (s: Settle) => s.outcome !== 'SPLIT' || Number(s.share) > 0;

  return (
    <>
      <Heading title={t('nav.disputes')} sub={t('disputes.sub')} />
      <Segmented
        label={t('disputes.filter')}
        value={view}
        onChange={setView}
        options={[{ value: 'open', label: t('disputes.open') }, { value: 'settled', label: t('disputes.settledTab') }]}
      />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {disputes.error && <Failed message={disputes.error} onRetry={disputes.reload} />}
        {disputes.loading && <Loading />}
        {disputes.data && rows.length === 0 && <Empty title={view === 'open' ? t('disputes.none') : t('disputes.noneSettled')} />}
        {rows.map((dispute) => {
          const { contract } = dispute;
          const byClient = dispute.raisedById === contract.clientId;
          return (
            <div key={dispute.id} className={`${row} flex-col !items-stretch`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1 text-sm">
                  <b className="text-ink-900 dark:text-white">{contract.freelanceJob.title}</b>
                  <span className={muted}>
                    {t('disputes.parties', { client: fullName(contract.client), freelancer: fullName(contract.freelancer), amount: money(contract.agreedAmount, dispute) })}
                  </span>
                  <span className={muted}>
                    {t('disputes.raised', { who: byClient ? t('disputes.client') : t('disputes.freelancer'), date: formatDateTime(dispute.createdAt, locale) })}
                  </span>
                </div>
                {dispute.outcome && <Badge tone="green">{t(`disputes.outcome.${dispute.outcome}`)}</Badge>}
              </div>
              <p className="whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-800 dark:bg-slate-950 dark:text-slate-200">{dispute.reason}</p>
              {dispute.resolution && (
                <p className="text-sm text-ink-700 dark:text-slate-300">
                  <b>{t('disputes.decision')}</b> {dispute.resolution}
                  {dispute.outcome === 'SPLIT' && dispute.freelancerAmount !== null && ` (${t('disputes.splitShare', { amount: money(dispute.freelancerAmount, dispute) })})`}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={outline} onClick={() => setReading(reading === dispute.id ? null : dispute.id)}>
                  {reading === dispute.id ? t('disputes.hideChat') : t('disputes.showChat')}
                </button>
                {!dispute.resolvedAt && (
                  <button type="button" className={solid} onClick={() => setSettling({ dispute, outcome: 'REFUND', share: '', resolution: '' })}>
                    {t('disputes.settle')}
                  </button>
                )}
              </div>
              {reading === dispute.id && <Conversation disputeId={dispute.id} />}
            </div>
          );
        })}
      </section>

      {settling && (
        <Dialog
          title={t('disputes.settleTitle', { title: settling.dispute.contract.freelanceJob.title })}
          text={t('disputes.settleText')}
          confirm={t('disputes.settle')}
          tone="danger"
          busy={action.busy}
          disabled={settling.resolution.trim().length < 10 || !shareValid(settling)}
          onCancel={() => setSettling(null)}
          onConfirm={settle}
        >
          <Field label={t('disputes.outcomeLabel')}>
            <select value={settling.outcome} onChange={(e) => setSettling({ ...settling, outcome: e.target.value as Outcome })} className={input}>
              {(['REFUND', 'RELEASE', 'SPLIT'] as const).map((o) => <option key={o} value={o}>{t(`disputes.outcome.${o}`)}</option>)}
            </select>
          </Field>
          {settling.outcome === 'SPLIT' && (
            <Field label={t('disputes.share')} hint={t('disputes.shareHint', { amount: money(settling.dispute.contract.agreedAmount, settling.dispute) })}>
              <input type="number" min={1} value={settling.share} onChange={(e) => setSettling({ ...settling, share: e.target.value })} className={input} />
            </Field>
          )}
          <Field label={t('disputes.resolution')} hint={t('disputes.resolutionHint')}>
            <textarea rows={3} value={settling.resolution} onChange={(e) => setSettling({ ...settling, resolution: e.target.value })} className={`${input} py-2`} />
          </Field>
        </Dialog>
      )}
    </>
  );
}

/** The contract's chat, so the decision rests on what both sides actually said. */
function Conversation({ disputeId }: { disputeId: string }) {
  const { t, locale } = useI18n();
  const chat = useResource((signal) => api<{ chatHistory: Message[] } | null>(`/admin/disputes/${disputeId}/arbitration`, { signal }), disputeId);
  if (chat.error) return <Failed message={chat.error} onRetry={chat.reload} />;
  if (chat.loading) return <Loading />;
  const messages = chat.data?.chatHistory ?? [];
  if (messages.length === 0) return <p className={muted}>{t('disputes.noChat')}</p>;
  return (
    <ol className="flex max-h-[360px] flex-col gap-2 overflow-y-auto rounded-lg border border-ink-200 p-3 dark:border-slate-800">
      {messages.map((message) => (
        <li key={message.id} className="text-sm">
          <span className={muted}>{fullName(message.sender)} · {formatDateTime(message.createdAt, locale)}</span>
          <p className="whitespace-pre-line text-ink-800 dark:text-slate-200">{message.content}</p>
        </li>
      ))}
    </ol>
  );
}
