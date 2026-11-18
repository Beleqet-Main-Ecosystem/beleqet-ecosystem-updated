'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { initials, monthYear, safeHttpUrl } from '@/features/jobs/format';
import { acceptBid, rejectBid, type GigBid } from '../actions';
import { errorText } from '@/lib/api-error';

const outline = 'inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-3.5 text-sm font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:text-white';
const solid = 'inline-flex min-h-11 items-center rounded-lg bg-obsidian px-3.5 text-sm font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';

type Props = {
  bids: GigBid[] | null;
  failed: boolean;
  contractId: string | null;
  onRetry: () => void;
  onChange: (bids: GigBid[]) => void;
  onContract: (id: string) => void;
};

const shortName = (bid: GigBid) => `${bid.freelancer.firstName} ${bid.freelancer.lastName.charAt(0)}.`.trim();

export default function BidList({ bids, failed, contractId, onRetry, onChange, onContract }: Props) {
  const { t, locale } = useTranslation();
  const [confirming, setConfirming] = useState<GigBid | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!confirming) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setConfirming(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [confirming]);

  const money = (value: number) => `ETB ${value.toLocaleString('en-US')}`;

  async function decline(bid: GigBid) {
    setWorking(true);
    setError('');
    try {
      await rejectBid(bid.id);
      onChange((bids ?? []).map((item) => (item.id === bid.id ? { ...item, status: 'REJECTED' } : item)));
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    } finally {
      setWorking(false);
    }
  }

  async function accept(bid: GigBid) {
    setWorking(true);
    setError('');
    try {
      const contract = await acceptBid(bid.id);
      onContract(contract.id);
      onChange((bids ?? []).map((item) => ({ ...item, status: item.id === bid.id ? 'ACCEPTED' : 'REJECTED' })));
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    } finally {
      setWorking(false);
      setConfirming(null);
    }
  }

  const accepted = bids?.find((bid) => bid.status === 'ACCEPTED');

  return (
    <section aria-labelledby="bids-h" className="rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 pb-2.5">
        <h2 id="bids-h" className="text-[19px] font-bold text-ink-900 dark:text-white">
          {t('freelance.gig.bidsReceived').replace('{count}', String(bids?.length ?? 0))}
        </h2>
        <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.gig.newestFirst')}</span>
      </div>

      {accepted && (
        <div role="status" className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-[#EEF5EF] p-3.5 dark:bg-forest/30">
          <span className="flex-[1_1_260px] text-sm font-semibold text-ink-900 dark:text-white">
            {t('freelance.gig.acceptedNote').replace('{name}', shortName(accepted))}
          </span>
          {contractId && <Link href={`/freelance/contracts/${contractId}`} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('freelance.gig.openContract')} →</Link>}
        </div>
      )}
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

      {failed ? (
        <div className="flex flex-col items-start gap-2 border-t border-[#F1F4F6] py-4 dark:border-slate-800">
          <p role="alert" className="text-sm text-ink-700 dark:text-slate-300">{t('freelance.gig.bidsFailed')}</p>
          <button type="button" onClick={onRetry} className={outline}>{t('freelance.retry')}</button>
        </div>
      ) : bids === null ? (
        <p className="border-t border-[#F1F4F6] py-4 text-sm text-ink-500 dark:border-slate-800 dark:text-slate-400">{t('freelance.loadingMore')}</p>
      ) : bids.length === 0 ? (
        <p className="border-t border-[#F1F4F6] py-4 text-sm text-ink-500 dark:border-slate-800 dark:text-slate-300">{t('freelance.gig.noBids')}</p>
      ) : (
        bids.map((bid) => (
          <article key={bid.id} className="flex flex-wrap gap-x-[18px] gap-y-3.5 border-t border-[#F1F4F6] py-[18px] dark:border-slate-800">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">
              {initials(`${bid.freelancer.firstName} ${bid.freelancer.lastName}`)}
            </span>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
              <b className="text-base text-ink-900 dark:text-white">{shortName(bid)}</b>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-500 dark:text-slate-400">
                {bid.freelancer.completedContracts !== undefined && (
                  <span>{t(bid.freelancer.completedContracts === 1 ? 'freelance.oneCompleted' : 'freelance.completed').replace('{count}', String(bid.freelancer.completedContracts))}</span>
                )}
                {bid.freelancer.memberSince && <span>{t('freelance.memberSince').replace('{date}', monthYear(bid.freelancer.memberSince, locale))}</span>}
                {safeHttpUrl(bid.freelancer.portfolioUrl) && (
                  <a href={safeHttpUrl(bid.freelancer.portfolioUrl)!} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-forest hover:underline dark:text-limeAccent">
                    {t('freelance.viewPortfolio')} ↗
                  </a>
                )}
              </span>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{bid.coverLetter}</p>
            </div>
            <div className="flex flex-auto flex-col items-end gap-2.5 md:flex-none">
              <span className="text-right">
                <b className="block text-lg text-ink-900 dark:text-white">{money(bid.amount)}</b>
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.gig.days').replace('{days}', String(bid.timelineDays))}</span>
              </span>
              {bid.status === 'PENDING' ? (
                <span className="flex gap-2">
                  <button type="button" disabled={working} onClick={() => decline(bid)} className={outline}>{t('freelance.gig.decline')}</button>
                  <button type="button" disabled={working} onClick={() => setConfirming(bid)} className={solid}>{t('freelance.gig.accept')}</button>
                </span>
              ) : (
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${bid.status === 'ACCEPTED' ? 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent' : 'bg-[#F1F4F6] text-ink-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {t(bid.status === 'ACCEPTED' ? 'freelance.gig.accepted' : 'freelance.gig.declined')}
                </span>
              )}
            </div>
          </article>
        ))
      )}

      {confirming && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="acc-h" aria-describedby="acc-d" className="flex w-full max-w-[460px] flex-col gap-3.5 rounded-xl bg-surface p-6 dark:bg-slate-900">
            <h2 id="acc-h" className="text-[19px] font-extrabold text-ink-900 dark:text-white">
              {t('freelance.gig.confirmTitle').replace('{name}', shortName(confirming))}
            </h2>
            <p id="acc-d" className="text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">
              {t('freelance.gig.confirmText').replace('{amount}', money(confirming.amount))}
            </p>
            <span className="flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus onClick={() => setConfirming(null)} className={outline}>{t('freelance.gig.cancel')}</button>
              <button type="button" disabled={working} onClick={() => accept(confirming)} className={solid}>{t('freelance.gig.confirmAccept')}</button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
