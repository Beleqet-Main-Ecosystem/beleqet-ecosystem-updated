'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, Pager, Segmented, card, input, link, muted, outline, row, solid, useAction, useDebounced, useResource, type Tone } from '@/components/ui';
import { api, query } from '@/lib/api';
import { SITE_URL, formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { canTakeDown } from '@/lib/rules';

type View = 'REVIEW' | 'ALL';
type Kind = 'ALL' | 'JOB' | 'GIG';
type Listing = {
  id: string;
  type: 'JOB' | 'GIG';
  title: string;
  description?: string;
  requirements?: string | null;
  gender?: string | null;
  reviewNote?: string | null;
  creatorName: string;
  creatorEmail?: string;
  category?: string;
  location?: string;
  compensation: string;
  status: string;
  createdAt: string;
};
const LIMIT = 25;
const TONE: Record<string, Tone> = { PUBLISHED: 'green', OPEN: 'green', PENDING_REVIEW: 'amber', IN_PROGRESS: 'amber', FUNDED: 'amber', ARCHIVED: 'red', CANCELLED: 'red', REJECTED: 'red' };
const REVIEW_PATH = `/admin/moderation/items${query({ type: 'JOB', status: 'PENDING_REVIEW' })}`;

/**
 * New jobs wait here until an admin approves them; a rejection says why, and the employer can fix
 * the job and send it again. Admins also take down anything live that breaks the rules. Funded
 * projects hold escrow money and are settled through a dispute instead.
 */
export default function ListingsPage() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>('REVIEW');
  const [kind, setKind] = useState<Kind>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const settled = useDebounced(search.trim());
  const path = `/admin/moderation/items${query({ type: kind, search: settled })}`;
  const listings = useResource((signal) => api<Listing[]>(path, { signal }), path);
  const waiting = useResource((signal) => api<Listing[]>(REVIEW_PATH, { signal }), REVIEW_PATH);
  const action = useAction();
  const [taking, setTaking] = useState<Listing | null>(null);
  const [rejecting, setRejecting] = useState<{ listing: Listing; note: string } | null>(null);

  const all = listings.data ?? [];
  const pages = Math.max(1, Math.ceil(all.length / LIMIT));
  const shown = all.slice((page - 1) * LIMIT, page * LIMIT);
  const reloadBoth = () => {
    waiting.reload();
    listings.reload();
  };

  async function takeDown(listing: Listing) {
    const path = listing.type === 'JOB' ? `/admin/moderation/jobs/${listing.id}/status` : `/admin/moderation/gigs/${listing.id}/status`;
    const ok = await action.run(
      () => api(path, { method: 'PATCH', body: { status: listing.type === 'JOB' ? 'ARCHIVED' : 'CANCELLED' } }),
      t('listings.takenDown', { title: listing.title }),
    );
    if (ok) {
      setTaking(null);
      reloadBoth();
    }
  }

  async function approve(listing: Listing) {
    const ok = await action.run(
      () => api(`/admin/moderation/jobs/${listing.id}/approve`, { method: 'POST' }),
      t('listings.approved', { title: listing.title }),
    );
    if (ok) reloadBoth();
  }

  async function reject(listing: Listing, note: string) {
    const ok = await action.run(
      () => api(`/admin/moderation/jobs/${listing.id}/reject`, { method: 'POST', body: { note } }),
      t('listings.rejected', { title: listing.title }),
    );
    if (ok) {
      setRejecting(null);
      reloadBoth();
    }
  }

  const count = waiting.data?.length;

  return (
    <>
      <Heading title={t('nav.listings')} sub={t('listings.sub')} />
      <Segmented
        label={t('listings.view')}
        value={view}
        onChange={setView}
        options={[
          { value: 'REVIEW' as const, label: count ? `${t('listings.views.REVIEW')} (${count})` : t('listings.views.REVIEW') },
          { value: 'ALL' as const, label: t('listings.views.ALL') },
        ]}
      />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />

      {view === 'REVIEW' && (
        <section className={card}>
          {waiting.error && <Failed message={waiting.error} onRetry={waiting.reload} />}
          {waiting.loading && <Loading />}
          {waiting.data?.length === 0 && <Empty title={t('listings.noneWaiting')} />}
          {waiting.data?.map((listing) => (
            <div key={listing.id} className={`${row} items-start`}>
              <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-ink-900 dark:text-white">{listing.title}</b>
                  <Badge tone="amber">{t('listings.status.PENDING_REVIEW')}</Badge>
                </span>
                <span className="text-ink-700 dark:text-slate-300">{listing.creatorName}{listing.creatorEmail ? ` · ${listing.creatorEmail}` : ''}</span>
                <span className={muted}>
                  {[listing.category, listing.location, listing.compensation, listing.gender ? t('listings.gender', { gender: listing.gender }) : '', formatDate(listing.createdAt, locale)].filter(Boolean).join(' · ')}
                </span>
                {/* The whole text: nothing goes live that an admin hasn't read. */}
                <details className="rounded-lg border border-ink-200 p-3 dark:border-slate-700">
                  <summary className="cursor-pointer font-semibold text-ink-900 dark:text-white">{t('listings.readJob')}</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words text-ink-700 dark:text-slate-300">{listing.description}</p>
                  {listing.requirements && (
                    <>
                      <b className="mt-3 block text-ink-900 dark:text-white">{t('listings.requirements')}</b>
                      <p className="mt-1 whitespace-pre-wrap break-words text-ink-700 dark:text-slate-300">{listing.requirements}</p>
                    </>
                  )}
                </details>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={action.busy} className={outline} onClick={() => setRejecting({ listing, note: '' })}>{t('listings.reject')}</button>
                <button type="button" disabled={action.busy} className={solid} onClick={() => approve(listing)}>{t('listings.approve')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {view === 'ALL' && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Segmented
              label={t('listings.kind')}
              value={kind}
              onChange={(value) => { setKind(value); setPage(1); }}
              options={(['ALL', 'JOB', 'GIG'] as const).map((value) => ({ value, label: t(`listings.kinds.${value}`) }))}
            />
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('listings.search')} aria-label={t('listings.search')} className={`${input} sm:max-w-[320px]`} />
          </div>
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
                  {listing.status === 'REJECTED' && listing.reviewNote && <span className="text-ink-700 dark:text-slate-300">{t('listings.reason', { note: listing.reviewNote })}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* A job that isn't public has no page on the site to open. */}
                  {!['DRAFT', 'PENDING_REVIEW', 'REJECTED'].includes(listing.status) && (
                    <a href={`${SITE_URL}/${listing.type === 'JOB' ? 'jobs' : 'freelance'}/${listing.id}`} target="_blank" rel="noreferrer" className={`${link} px-2 text-sm`}>{t('listings.open')}</a>
                  )}
                  {canTakeDown(listing) && (
                    <button type="button" disabled={action.busy} className={outline} onClick={() => setTaking(listing)}>{t('listings.takeDown')}</button>
                  )}
                </div>
              </div>
            ))}
            {listings.data && <Pager page={page} pages={pages} total={all.length} onPage={setPage} />}
          </section>
        </>
      )}

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
      {rejecting && (
        <Dialog
          title={t('listings.rejectTitle', { title: rejecting.listing.title })}
          confirm={t('listings.reject')}
          busy={action.busy}
          disabled={rejecting.note.trim().length < 3}
          onCancel={() => setRejecting(null)}
          onConfirm={() => reject(rejecting.listing, rejecting.note.trim())}
        >
          <Field label={t('listings.reasonLabel')} hint={t('listings.reasonHint')}>
            <textarea rows={3} value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} className={`${input} py-2`} />
          </Field>
        </Dialog>
      )}
    </>
  );
}
