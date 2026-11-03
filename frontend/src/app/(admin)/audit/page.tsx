'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Badge, Empty, Failed, Heading, Loading, Notice, Pager, card, input, link, muted, outline, row, useAction, useDebounced, useResource, type Tone } from '@/components/ui';
import { api, download, query } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Entry = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  ipAddress: string | null;
  httpMethod: string | null;
  path: string | null;
  statusCode: number | null;
  payload: unknown;
  createdAt: string;
};
const LIMIT = 25;
const METHOD_TONE: Record<string, Tone> = { POST: 'green', PATCH: 'amber', PUT: 'amber', DELETE: 'red', GET: 'gray' };

/** Who changed what, when, from where. Page loads aren't recorded; changes and data exports are. */
export default function AuditPage() {
  const { t, locale } = useI18n();
  const [method, setMethod] = useState('');
  const [actor, setActor] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const settledSearch = useDebounced(search.trim());
  const settledActor = useDebounced(actor.trim());
  const action = useAction();

  const filters = {
    httpMethod: method,
    actorUserId: settledActor,
    search: settledSearch,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
    to: to ? new Date(`${to}T23:59:59`).toISOString() : '',
  };
  const path = `/admin/audit-logs${query({ ...filters, page, limit: LIMIT })}`;
  const entries = useResource((signal) => api<{ data: Entry[]; meta: { total: number; totalPages: number } }>(path, { signal }), path);
  const reset = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(1); };

  return (
    <>
      <Heading title={t('nav.audit')} sub={t('audit.sub')}>
        <button
          type="button"
          className={outline}
          disabled={action.busy}
          onClick={() => action.run(() => download(`/admin/audit-logs/export${query({ ...filters, format: 'csv' })}`, 'audit-log.csv'), t('audit.exported'))}
        >
          <Download className="h-4 w-4" aria-hidden="true" /> {t('audit.export')}
        </button>
      </Heading>
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_1fr_1fr_150px_150px]">
        <select value={method} onChange={(e) => reset(setMethod)(e.target.value)} aria-label={t('audit.action')} className={input}>
          <option value="">{t('audit.anyAction')}</option>
          {['POST', 'PATCH', 'PUT', 'DELETE', 'GET'].map((value) => <option key={value} value={value}>{t(`audit.methods.${value}`)}</option>)}
        </select>
        <input type="search" value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder={t('audit.search')} aria-label={t('audit.search')} className={input} />
        <input type="search" value={actor} onChange={(e) => reset(setActor)(e.target.value)} placeholder={t('audit.actor')} aria-label={t('audit.actor')} className={input} />
        <input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} aria-label={t('audit.from')} className={input} />
        <input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} aria-label={t('audit.to')} className={input} />
      </div>
      <section className={card}>
        {entries.error && <Failed message={entries.error} onRetry={entries.reload} />}
        {entries.loading && <Loading />}
        {entries.data?.data.length === 0 && <Empty title={t('audit.none')} />}
        {entries.data?.data.map((entry) => (
          <div key={entry.id} className={`${row} flex-col !items-stretch`}>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  {entry.httpMethod && <Badge tone={METHOD_TONE[entry.httpMethod] ?? 'gray'}>{t(`audit.methods.${entry.httpMethod}`)}</Badge>}
                  <code className="break-all text-[13px] text-ink-900 dark:text-white">{entry.path ?? `${entry.eventType} · ${entry.entityType}`}</code>
                  {entry.statusCode !== null && <Badge tone={entry.statusCode >= 400 ? 'red' : 'gray'}>{entry.statusCode}</Badge>}
                </span>
                <span className={muted}>
                  {formatDateTime(entry.createdAt, locale)} · {entry.ipAddress ?? '—'} ·{' '}
                  {entry.actorUserId ? (
                    <button type="button" className={link} onClick={() => reset(setActor)(entry.actorUserId ?? '')}>{t('audit.byActor', { id: entry.actorUserId.slice(0, 8) })}</button>
                  ) : t('audit.anonymous')}
                </span>
              </div>
              <button type="button" className={`${link} text-sm`} onClick={() => setOpen(open === entry.id ? null : entry.id)}>
                {open === entry.id ? t('audit.hide') : t('audit.details')}
              </button>
            </div>
            {open === entry.id && (
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ink-50 p-3 text-xs text-ink-800 dark:bg-slate-950 dark:text-slate-200">{JSON.stringify(entry.payload, null, 2)}</pre>
            )}
          </div>
        ))}
        {entries.data && <Pager page={page} pages={Math.max(1, entries.data.meta.totalPages)} total={entries.data.meta.total} onPage={setPage} />}
      </section>
    </>
  );
}
