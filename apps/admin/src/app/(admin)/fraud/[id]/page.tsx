'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge, Failed, Field, Heading, Loading, Notice, card, input, link, muted, solid, useAction, useResource, type Tone } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, fullName, words } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const SEVERITY_TONE: Record<string, Tone> = { LOW: 'gray', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };
const DECISIONS = ['CONFIRMED', 'RESOLVED', 'FALSE_POSITIVE'] as const;

type Alert = {
  id: string;
  ruleType: string;
  severity: string;
  score: number;
  reason: string;
  status: string;
  entityType: string;
  entityId: string;
  evidence: unknown;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  resolvedBy: { firstName: string; lastName: string } | null;
};

export default function FraudAlertPage({ params }: { params: { id: string } }) {
  const { t, locale } = useI18n();
  const detail = useResource((signal) => api<{ alert: Alert; context: Record<string, unknown> }>(`/admin/fraud/alerts/${params.id}`, { signal }), params.id);
  const action = useAction();
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>('RESOLVED');
  const [note, setNote] = useState('');

  const alert = detail.data?.alert;
  const closed = alert && ['RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED'].includes(alert.status);

  async function decide() {
    const ok = await action.run(
      () => api(`/admin/fraud/alerts/${params.id}`, { method: 'PATCH', body: { status: decision, resolutionNote: note.trim() || undefined } }),
      t('fraud.decided'),
    );
    if (ok) detail.reload();
  }

  return (
    <>
      <Link href="/fraud" className={`${link} inline-flex items-center gap-1 text-sm`}><ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t('fraud.back')}</Link>
      {detail.error && <div className={card}><Failed message={detail.error} onRetry={detail.reload} /></div>}
      {detail.loading && <div className={card}><Loading /></div>}
      {alert && (
        <>
          <Heading title={t(`fraud.types.${alert.ruleType}`)} sub={alert.reason} />
          <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
          <section className={`${card} grid gap-4 sm:grid-cols-2`}>
            <Fact label={t('fraud.severity')}><Badge tone={SEVERITY_TONE[alert.severity]}>{t(`fraud.severities.${alert.severity}`)} · {alert.score}</Badge></Fact>
            <Fact label={t('fraud.status')}><Badge>{t(`fraud.statuses.${alert.status}`)}</Badge></Fact>
            <Fact label={t('fraud.who')}>{alert.user ? `${fullName(alert.user)} · ${alert.user.email}` : '—'}</Fact>
            <Fact label={t('fraud.what')}>{words(alert.entityType)} · <span className="break-all">{alert.entityId}</span></Fact>
            <Fact label={t('fraud.raised')}>{formatDateTime(alert.createdAt, locale)}</Fact>
            {alert.resolvedAt && <Fact label={t('fraud.decidedBy')}>{fullName(alert.resolvedBy)} · {formatDateTime(alert.resolvedAt, locale)}</Fact>}
            {alert.resolutionNote && <Fact label={t('fraud.note')}>{alert.resolutionNote}</Fact>}
          </section>

          <section className={card}>
            <h2 className="mb-2 font-bold text-ink-900 dark:text-white">{t('fraud.evidence')}</h2>
            {alert.evidence ? (
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink-50 p-3 text-xs text-ink-800 dark:bg-slate-950 dark:text-slate-200">{JSON.stringify(alert.evidence, null, 2)}</pre>
            ) : (
              <p className={muted}>{t('fraud.noEvidence')}</p>
            )}
          </section>

          {!closed && (
            <section className={`${card} flex max-w-[640px] flex-col gap-4`}>
              <h2 className="font-bold text-ink-900 dark:text-white">{t('fraud.decide')}</h2>
              <Field label={t('fraud.outcome')}>
                <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)} className={input}>
                  {DECISIONS.map((value) => <option key={value} value={value}>{t(`fraud.statuses.${value}`)}</option>)}
                </select>
              </Field>
              <Field label={t('fraud.note')} hint={t('fraud.noteHint')}>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} py-2`} />
              </Field>
              <div><button type="button" disabled={action.busy} className={solid} onClick={decide}>{action.busy ? t('common.working') : t('fraud.save')}</button></div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className={muted}>{label}</span>
      <span className="text-ink-900 dark:text-white">{children}</span>
    </div>
  );
}
