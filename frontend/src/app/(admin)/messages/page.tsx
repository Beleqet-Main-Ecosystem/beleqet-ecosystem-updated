'use client';

import { useState } from 'react';
import { Badge, Empty, Failed, Heading, Loading, Notice, Pager, Segmented, card, link, muted, outline, row, useAction, useResource, type Tone } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Status = 'NEW' | 'READ' | 'RESOLVED';
type Contact = { id: string; name: string; email: string; subject: string; message: string; status: Status; createdAt: string };
const LIMIT = 20;
const TONE: Record<Status, Tone> = { NEW: 'amber', READ: 'gray', RESOLVED: 'green' };

/** Messages sent through the website's contact form. */
export default function MessagesPage() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<Status | 'ALL'>('NEW');
  const [page, setPage] = useState(1);
  const contacts = useResource((signal) => api<Contact[]>('/admin/contacts', { signal }), 'contacts');
  const action = useAction();

  const all = (contacts.data ?? []).filter((c) => filter === 'ALL' || c.status === filter);
  const shown = all.slice((page - 1) * LIMIT, page * LIMIT);

  const mark = (contact: Contact, status: Status) =>
    action.run(() => api(`/admin/contacts/${contact.id}/status`, { method: 'PATCH', body: { status } }), t(`messages.marked.${status}`)).then((ok) => ok && contacts.reload());

  return (
    <>
      <Heading title={t('nav.messages')} sub={t('messages.sub')} />
      <Segmented
        label={t('messages.filter')}
        value={filter}
        onChange={(value) => { setFilter(value); setPage(1); }}
        options={(['NEW', 'READ', 'RESOLVED', 'ALL'] as const).map((value) => ({ value, label: t(`messages.status.${value}`) }))}
      />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {contacts.error && <Failed message={contacts.error} onRetry={contacts.reload} />}
        {contacts.loading && <Loading />}
        {contacts.data && all.length === 0 && <Empty title={t('messages.none')} />}
        {shown.map((contact) => (
          <article key={contact.id} className={`${row} flex-col !items-stretch`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <b className="text-ink-900 dark:text-white">{contact.subject}</b>
                <span className={muted}>
                  {contact.name} · <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Re: ${contact.subject}`)}`} className={link}>{contact.email}</a> · {formatDateTime(contact.createdAt, locale)}
                </span>
              </div>
              <Badge tone={TONE[contact.status]}>{t(`messages.status.${contact.status}`)}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink-700 dark:text-slate-300">{contact.message}</p>
            <div className="flex flex-wrap gap-2">
              {contact.status !== 'READ' && <button type="button" disabled={action.busy} className={outline} onClick={() => mark(contact, 'READ')}>{t('messages.markRead')}</button>}
              {contact.status !== 'RESOLVED' && <button type="button" disabled={action.busy} className={outline} onClick={() => mark(contact, 'RESOLVED')}>{t('messages.markResolved')}</button>}
            </div>
          </article>
        ))}
        {contacts.data && <Pager page={page} pages={Math.max(1, Math.ceil(all.length / LIMIT))} total={all.length} onPage={setPage} />}
      </section>
    </>
  );
}
