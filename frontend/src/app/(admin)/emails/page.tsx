'use client';

import { useState } from 'react';
import { Badge, Empty, Failed, Heading, Loading, Notice, Pager, Segmented, card, input, muted, outline, row, useAction, useDebounced, useResource, type Tone } from '@/components/ui';
import { api, query } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Status = '' | 'SENT' | 'FAILED' | 'QUEUED' | 'PENDING' | 'BOUNCED';
type Email = {
  id: string;
  recipient: string;
  type: string;
  status: Exclude<Status, ''>;
  subject: string;
  errorMessage: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
};
const PAGE_SIZE = 25;
const TONE: Record<string, Tone> = { SENT: 'green', FAILED: 'red', BOUNCED: 'red', QUEUED: 'amber', PENDING: 'amber' };

/** Every email the platform tried to send; failed ones can be sent again. */
export default function EmailsPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>('');
  const [recipient, setRecipient] = useState('');
  const [page, setPage] = useState(1);
  const settled = useDebounced(recipient.trim());
  const path = `/admin/emails/logs${query({ status, recipient: settled, page, pageSize: PAGE_SIZE })}`;
  const emails = useResource((signal) => api<{ items: Email[]; total: number }>(path, { signal }), path);
  const action = useAction();

  return (
    <>
      <Heading title={t('nav.emails')} sub={t('emails.sub')} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          label={t('emails.filter')}
          value={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          options={(['', 'FAILED', 'SENT', 'QUEUED', 'BOUNCED'] as const).map((value) => ({ value, label: t(`emails.status.${value || 'ALL'}`) }))}
        />
        <input type="search" value={recipient} onChange={(e) => { setRecipient(e.target.value); setPage(1); }} placeholder={t('emails.search')} aria-label={t('emails.search')} className={`${input} sm:max-w-[300px]`} />
      </div>
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {emails.error && <Failed message={emails.error} onRetry={emails.reload} />}
        {emails.loading && <Loading />}
        {emails.data?.items.length === 0 && <Empty title={t('emails.none')} />}
        {emails.data?.items.map((email) => (
          <div key={email.id} className={row}>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-ink-900 dark:text-white">{email.subject}</b>
                <Badge tone={TONE[email.status] ?? 'gray'}>{t(`emails.status.${email.status}`)}</Badge>
              </span>
              <span className={`${muted} break-all`}>{email.recipient} · {email.type.replaceAll('_', ' ').toLowerCase()} · {formatDateTime(email.sentAt ?? email.createdAt, locale)}</span>
              {email.errorMessage && <span className="text-red-700 dark:text-red-300">{t('emails.error', { error: email.errorMessage, attempts: email.attempts })}</span>}
            </div>
            {(email.status === 'FAILED' || email.status === 'BOUNCED') && (
              <button
                type="button"
                disabled={action.busy}
                className={outline}
                onClick={() => action.run(() => api(`/admin/emails/logs/${email.id}/resend`, { method: 'POST' }), t('emails.resent', { to: email.recipient })).then((ok) => ok && emails.reload())}
              >
                {t('emails.resend')}
              </button>
            )}
          </div>
        ))}
        {emails.data && <Pager page={page} pages={Math.max(1, Math.ceil(emails.data.total / PAGE_SIZE))} total={emails.data.total} onPage={setPage} />}
      </section>
    </>
  );
}
