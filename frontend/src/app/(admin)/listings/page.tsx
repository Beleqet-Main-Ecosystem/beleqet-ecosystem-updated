'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Heading, Loading, Notice, Pager, Segmented, card, input, link, muted, outline, row, useAction, useDebounced, useResource, type Tone } from '@/components/ui';
import { api, query } from '@/lib/api';
import { SITE_URL, formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { canTakeDown } from '@/lib/rules';

type Kind = 'ALL' | 'JOB' | 'GIG';
type Listing = {
  id: string;
  type: 'JOB' | 'GIG';
  title: string;
  creatorName: string;
  creatorEmail?: string;
  category?: string;
  location?: string;
  compensation: string;
  status: string;
  createdAt: string;
};
const LIMIT = 25;
const TONE: Record<string, Tone> = { PUBLISHED: 'green', OPEN: 'green', IN_PROGRESS: 'amber', FUNDED: 'amber', ARCHIVED: 'red', CANCELLED: 'red' };

/**
 * Jobs and projects go live when their owner publishes them; admins take down what breaks
 * the rules. Funded projects hold escrow money and are settled through a dispute instead.
 */
export default function ListingsPage() {
  const { t, locale } = useI18n();
  const [kind, setKind] = useState<Kind>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const settled = useDebounced(search.trim());
  const path = `/admin/moderation/items${query({ type: kind, search: settled })}`;
  const listings = useResource((signal) => api<Listing[]>(path, { signal }), path);
  const action = useAction();
  const [taking, setTaking] = useState<Listing | null>(null);

  const all = listings.data ?? [];
  const pages = Math.max(1, Math.ceil(all.length / LIMIT));
  const shown = all.slice((page - 1) * LIMIT, page * LIMIT);

  async function takeDown(listing: Listing) {
    const path = listing.type === 'JOB' ? `/admin/moderation/jobs/${listing.id}/status` : `/admin/moderation/gigs/${listing.id}/status`;
    const ok = await action.run(
      () => api(path, { method: 'PATCH', body: { status: listing.type === 'JOB' ? 'ARCHIVED' : 'CANCELLED' } }),
      t('listings.takenDown', { title: listing.title }),
    );
    if (ok) {
      setTaking(null);
      listings.reload();
    }
  }

  return (
    <>
      <Heading title={t('nav.listings')} sub={t('listings.sub')} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          label={t('listings.kind')}
          value={kind}
          onChange={(value) => { setKind(value); setPage(1); }}
          options={(['ALL', 'JOB', 'GIG'] as const).map((value) => ({ value, label: t(`listings.kinds.${value}`) }))}
        />
        <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('listings.search')} aria-label={t('listings.search')} className={`${input} sm:max-w-[320px]`} />
      </div>
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {listings.error && <Failed message={listings.error} onRetry={listings.reload} />}
        {listings.loading && <Loading />}
        {listings.data?.length === 0 && <Empty title={t('listings.none')} />}
        {shown.map((listing) => (
          <div key={`${listing.type}-${listing.id}`} className={row}>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-ink-900 dark:text-white">{listing.title}</b>
                <Badge>{t(`listings.kinds.${listing.type}`)}</Badge>
                <Badge tone={TONE[listing.status] ?? 'gray'}>{t(`listings.status.${listing.status}`)}</Badge>
              </span>
              <span className="text-ink-700 dark:text-slate-300">{listing.creatorName}{listing.creatorEmail ? ` · ${listing.creatorEmail}` : ''}</span>
              <span className={muted}>{[listing.category, listing.location, listing.compensation, formatDate(listing.createdAt, locale)].filter(Boolean).join(' · ')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={`${SITE_URL}/${listing.type === 'JOB' ? 'jobs' : 'freelance'}/${listing.id}`} target="_blank" rel="noreferrer" className={`${link} px-2 text-sm`}>{t('listings.open')}</a>
              {canTakeDown(listing) && (
                <button type="button" disabled={action.busy} className={outline} onClick={() => setTaking(listing)}>{t('listings.takeDown')}</button>
              )}
            </div>
          </div>
        ))}
        {listings.data && <Pager page={page} pages={pages} total={all.length} onPage={setPage} />}
      </section>
      {taking && (
        <Dialog
          title={t('listings.takeDownTitle', { title: taking.title })}
          text={taking.type === 'JOB' ? t('listings.takeDownJob') : t('listings.takeDownGig')}
          confirm={t('listings.takeDown')}
          tone="danger"
          busy={action.busy}
          onCancel={() => setTaking(null)}
          onConfirm={() => takeDown(taking)}
        />
      )}
    </>
  );
}
