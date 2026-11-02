'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import type { GigDetail as Gig } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget, initials, postedAgo, safeHttpUrl } from '@/features/jobs/format';
import { fetchGigBids, findContractId, type GigBid } from '../actions';
import BidForm from './BidForm';
import BidList from './BidList';

const heroTag = 'rounded-md px-2 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.04em]';
const card = 'rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';
const ESCROW_POINTS = ['fund', 'submit', 'hold', 'dispute'] as const;

export default function GigDetail({ gig }: { gig: Gig }) {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const [bids, setBids] = useState<GigBid[] | null>(null);
  const [bidsFailed, setBidsFailed] = useState(false);
  const [contractId, setContractId] = useState<string | null>(null);

  const isOwner = Boolean(user && user.id === gig.clientId);

  const loadBids = useCallback(async () => {
    setBidsFailed(false);
    try {
      setBids(await fetchGigBids(gig.id));
    } catch {
      setBidsFailed(true);
    }
  }, [gig.id]);

  useEffect(() => {
    if (!user) return;
    void loadBids();
    if (!gig.open) findContractId(gig.id).then(setContractId).catch(() => setContractId(null));
  }, [user, gig.id, gig.open, loadBids]);

  const open = gig.open && !bids?.some((bid) => bid.status === 'ACCEPTED');
  const myBid = bids?.find((bid) => bid.freelancer.id === user?.id) ?? null;
  const shownBidCount = bids?.length ?? gig.bidCount;
  const hourly = gig.pricingType === 'HOURLY';
  const budget = `${formatBudget(gig)}${hourly ? ` / ${t('freelance.hour')}` : ''}`;
  const attachments = gig.attachments.map(safeHttpUrl).filter((url): url is string => Boolean(url));

  const facts = [
    { label: t('freelance.gig.budget'), value: budget },
    { label: t('freelance.gig.pricing'), value: t(hourly ? 'freelance.hourly' : 'freelance.fixed') },
    gig.deadlineDays != null && { label: t('freelance.gig.delivery'), value: t('freelance.gig.within').replace('{days}', String(gig.deadlineDays)) },
    gig.experienceLevel && { label: t('freelance.gig.experience'), value: gig.experienceLevel },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3.5 px-4 pb-6 pt-3 md:px-[clamp(16px,4vw,40px)] md:pb-8">
          <div className="flex flex-wrap gap-2">
            {gig.funded && (
              <span className={`${heroTag} inline-flex items-center gap-1 bg-limeAccent/[0.14] text-limeAccent`}>
                <Check className="h-3 w-3" aria-hidden="true" />
                {t('freelance.funded')}
              </span>
            )}
            <span className={`${heroTag} bg-white/10 text-white`}>{t(hourly ? 'freelance.hourly' : 'freelance.fixed')}</span>
            <span className={`${heroTag} bg-white/10 text-white`}>{t(open ? 'freelance.gig.open' : 'freelance.gig.closed')}</span>
          </div>
          <h1 className="max-w-[860px] text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[clamp(26px,3vw,38px)]">{gig.title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/70">
            <span>{postedAgo(gig.createdAt, locale, t('freelance.recently'))}</span>
            <span>
              {shownBidCount} {t(shownBidCount === 1 ? 'freelance.bid' : 'freelance.bids')}
            </span>
            {gig.locationPreference && <span>{gig.locationPreference}</span>}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-4 px-4 pb-14 pt-4 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <section aria-label={t('freelance.gig.summary')} className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1 rounded-xl border border-ink-200 bg-surface p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{fact.label}</span>
                <b className="text-base text-ink-900 dark:text-white">{fact.value}</b>
              </div>
            ))}
          </section>

          <section aria-labelledby="desc-h" className={`${card} flex flex-col gap-3`}>
            <h2 id="desc-h" className="text-[19px] font-bold text-ink-900 dark:text-white">{t('freelance.gig.description')}</h2>
            <p className="whitespace-pre-line text-base leading-[1.7] text-ink-700 dark:text-slate-300">{gig.description}</p>
            {gig.skills.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1.5">
                {gig.skills.map((skill) => (
                  <li key={skill} className="rounded-full bg-[#F1F4F6] px-3 py-1.5 text-[13px] font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{skill}</li>
                ))}
              </ul>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-[#F1F4F6] pt-2.5 dark:border-slate-800">
                <b className="text-sm text-ink-900 dark:text-white">{t('freelance.gig.attachments')}</b>
                {attachments.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-forest hover:underline dark:text-limeAccent">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {decodeURIComponent(url.split('/').pop() || url)}
                  </a>
                ))}
              </div>
            )}
          </section>

          {isOwner && (
            <BidList bids={bids} failed={bidsFailed} contractId={contractId} onRetry={loadBids} onChange={setBids} onContract={setContractId} />
          )}
        </div>

        <aside className="flex w-full min-w-0 max-w-full flex-[1_1_320px] flex-col gap-4 md:max-w-[400px]">
          {ready && !isOwner && <BidForm gig={gig} myBid={myBid} contractId={contractId} onSent={loadBids} />}

          <section aria-labelledby="client-h" className={`${card} flex flex-col gap-3`}>
            <h2 id="client-h" className="text-[15px] font-bold text-ink-500 dark:text-slate-400">{t('freelance.gig.aboutClient')}</h2>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">
                {initials(gig.clientName)}
              </span>
              <b className="text-base text-ink-900 dark:text-white">{gig.clientName}</b>
            </div>
            {gig.funded && (
              <span className="flex items-center gap-2 text-sm font-semibold text-forest dark:text-limeAccent">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t('freelance.gig.budgetInEscrow')}
              </span>
            )}
          </section>

          <section aria-labelledby="protect-h" className="flex flex-col gap-3 rounded-xl bg-obsidian p-5 text-white md:p-6">
            <h2 id="protect-h" className="text-[15px] font-bold text-limeAccent">{t('freelance.gig.protectTitle')}</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-normal text-white/80">
              {ESCROW_POINTS.map((point) => (
                <li key={point}>{t(`freelance.gig.protect.${point}`)}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
