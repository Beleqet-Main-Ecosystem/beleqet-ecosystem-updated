'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Empty, Failed, Heading, Loading, Notice, Pager, Segmented, card, input, muted, outline, row, useAction, useResource, type Tone } from '@/components/ui';
import { api, query } from '@/lib/api';
import { formatDateTime, fullName, words } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const STATUSES = ['OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'RESOLVED', 'FALSE_POSITIVE'] as const;
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const SEVERITY_TONE: Record<string, Tone> = { LOW: 'gray', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };
const LIMIT = 20;

type Alert = {
  id: string;
  ruleType: string;
  severity: string;
  score: number;
  reason: string;
  status: string;
  entityType: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
};
type Rule = { id: string; name: string; ruleType: string; severity: string; enabled: boolean; config: Record<string, unknown> };

/** Alerts raised by the fraud rules, and the rules themselves. */
export default function FraudPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'alerts' | 'rules'>('alerts');
  return (
    <>
      <Heading title={t('nav.fraud')} sub={t('fraud.sub')} />
      <Segmented label={t('fraud.view')} value={tab} onChange={setTab} options={[{ value: 'alerts', label: t('fraud.alerts') }, { value: 'rules', label: t('fraud.rules') }]} />
      {tab === 'alerts' ? <Alerts /> : <Rules />}
    </>
  );
}

function Alerts() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState('OPEN');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);
  const path = `/admin/fraud/alerts${query({ status, severity, page, limit: LIMIT })}`;
  const alerts = useResource((signal) => api<{ data: Alert[]; meta: { total: number; totalPages: number } }>(path, { signal }), path);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[220px_220px]">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t('fraud.status')} className={input}>
          <option value="">{t('fraud.anyStatus')}</option>
          {STATUSES.map((value) => <option key={value} value={value}>{t(`fraud.statuses.${value}`)}</option>)}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} aria-label={t('fraud.severity')} className={input}>
          <option value="">{t('fraud.anySeverity')}</option>
          {SEVERITIES.map((value) => <option key={value} value={value}>{t(`fraud.severities.${value}`)}</option>)}
        </select>
      </div>
      <section className={card}>
        {alerts.error && <Failed message={alerts.error} onRetry={alerts.reload} />}
        {alerts.loading && <Loading />}
        {alerts.data?.data.length === 0 && <Empty title={t('fraud.none')} />}
        {alerts.data?.data.map((alert) => (
          <Link key={alert.id} href={`/fraud/${alert.id}`} className={`${row} -mx-2 rounded-lg px-2 hover:bg-ink-50 dark:hover:bg-slate-800/60`}>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-ink-900 dark:text-white">{t(`fraud.types.${alert.ruleType}`)}</b>
                <Badge tone={SEVERITY_TONE[alert.severity]}>{t(`fraud.severities.${alert.severity}`)} · {alert.score}</Badge>
                <Badge>{t(`fraud.statuses.${alert.status}`)}</Badge>
              </span>
              <span className="text-ink-700 dark:text-slate-300">{alert.reason}</span>
              <span className={muted}>{alert.user ? `${fullName(alert.user)} · ${alert.user.email}` : words(alert.entityType)} · {formatDateTime(alert.createdAt, locale)}</span>
            </div>
            <span className="self-center text-sm font-bold text-forest dark:text-limeAccent">{t('fraud.review')} →</span>
          </Link>
        ))}
        {alerts.data && <Pager page={page} pages={Math.max(1, alerts.data.meta.totalPages)} total={alerts.data.meta.total} onPage={setPage} />}
      </section>
    </>
  );
}

function Rules() {
  const { t } = useI18n();
  const rules = useResource((signal) => api<Rule[]>('/admin/fraud/rules', { signal }), 'rules');
  const action = useAction();

  const update = (rule: Rule, body: Partial<Pick<Rule, 'enabled' | 'severity'>>, done: string) =>
    action.run(() => api(`/admin/fraud/rules/${rule.id}`, { method: 'PATCH', body }), done).then((ok) => ok && rules.reload());

  return (
    <>
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {rules.error && <Failed message={rules.error} onRetry={rules.reload} />}
        {rules.loading && <Loading />}
        {rules.data?.map((rule) => (
          <div key={rule.id} className={row}>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-ink-900 dark:text-white">{t(`fraud.types.${rule.ruleType}`)}</b>
                <Badge tone={rule.enabled ? 'green' : 'gray'}>{rule.enabled ? t('fraud.on') : t('fraud.off')}</Badge>
              </span>
              <span className="text-ink-700 dark:text-slate-300">{t(`fraud.explain.${rule.ruleType}`)}</span>
              <span className={`${muted} break-all`}>{Object.entries(rule.config ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rule.severity}
                disabled={action.busy}
                aria-label={t('fraud.severityFor', { rule: t(`fraud.types.${rule.ruleType}`) })}
                onChange={(e) => update(rule, { severity: e.target.value }, t('fraud.ruleSaved'))}
                className={`${input} !w-auto`}
              >
                {SEVERITIES.map((value) => <option key={value} value={value}>{t(`fraud.severities.${value}`)}</option>)}
              </select>
              <button type="button" disabled={action.busy} className={outline} onClick={() => update(rule, { enabled: !rule.enabled }, rule.enabled ? t('fraud.turnedOff') : t('fraud.turnedOn'))}>
                {rule.enabled ? t('fraud.turnOff') : t('fraud.turnOn')}
              </button>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
