'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import type { GigDetail } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget } from '@/features/jobs/format';
import { ActionError, submitBid, type GigBid } from '../actions';

/** Same 10% as PLATFORM_FEE_PCT in the escrow service. */
const PLATFORM_FEE = 0.1;
const card = 'flex flex-col gap-3.5 rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';
const field = 'min-h-12 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const primary = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';

type Props = { gig: GigDetail; myBid: GigBid | null; contractId: string | null; onSent: () => void };

export default function BidForm({ gig, myBid, contractId, onSent }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState(gig.deadlineDays ? String(gig.deadlineDays) : '');
  const [letter, setLetter] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const money = (value: number) => `${gig.currency} ${Math.round(value).toLocaleString('en-US')}`;

  if (myBid) {
    const accepted = myBid.status === 'ACCEPTED';
    const rejected = myBid.status === 'REJECTED';
    return (
      <section className={card}>
        <CheckCircle2 className="h-7 w-7 text-forest dark:text-limeAccent" aria-hidden="true" />
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">
          {t(accepted ? 'freelance.gig.bidAccepted' : rejected ? 'freelance.gig.bidDeclined' : 'freelance.gig.bidSent')} · {money(myBid.amount)}
        </h2>
        {!accepted && !rejected && <p className="text-sm leading-relaxed text-ink-500 dark:text-slate-300">{t('freelance.gig.bidSentText')}</p>}
        {accepted && contractId ? (
          <Link href={`/freelance/contracts/${contractId}`} className={primary}>{t('freelance.gig.openContract')}</Link>
        ) : (
          <Link href="/dashboard" className={primary}>{t('freelance.gig.myBids')}</Link>
        )}
      </section>
    );
  }

  if (!gig.open) {
    return (
      <section className={card}>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('freelance.gig.closedTitle')}</h2>
        <p className="text-sm leading-relaxed text-ink-500 dark:text-slate-300">{t('freelance.gig.closedText')}</p>
        <Link href="/freelance" className={primary}>{t('freelance.gig.browse')}</Link>
      </section>
    );
  }

  if (!user) {
    return (
      <section className={card}>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('freelance.gig.placeBid')}</h2>
        <p className="text-sm leading-relaxed text-ink-500 dark:text-slate-300">{t('freelance.gig.signInText')}</p>
        <Link href={`/login?next=${encodeURIComponent(`/freelance/${gig.id}`)}`} className={primary}>{t('freelance.gig.signIn')}</Link>
      </section>
    );
  }

  // The API takes bids only from freelancer and job-seeker accounts.
  if (user.role === 'EMPLOYER' || user.role === 'ADMIN') {
    return (
      <section className={card}>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('freelance.gig.placeBid')}</h2>
        <p className="text-sm leading-relaxed text-ink-500 dark:text-slate-300">{t('freelance.gig.employerCantBid')}</p>
        <Link href="/freelance" className={primary}>{t('freelance.gig.browse')}</Link>
      </section>
    );
  }

  const price = Number(amount);
  const validPrice = Number.isFinite(price) && price >= 1;
  const fee = validPrice ? Math.round(price * PLATFORM_FEE) : 0;

  async function send(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!validPrice || !(Number(days) >= 1) || !letter.trim()) {
      setError(t('freelance.gig.formInvalid'));
      return;
    }
    setSending(true);
    try {
      await submitBid(gig.id, { amount: Math.round(price), timelineDays: Math.round(Number(days)), coverLetter: letter.trim() });
      onSent();
    } catch (err) {
      // Already bid, perhaps in another tab: reloading shows that bid.
      if (err instanceof ActionError && err.status === 409) onSent();
      else if (err instanceof ActionError && err.status === 403) setError(t('freelance.gig.employerCantBid'));
      else if (err instanceof ActionError && err.status === 404) setError(t('freelance.gig.bidClosed'));
      else setError(t('freelance.gig.bidFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} aria-labelledby="bid-h" className={card}>
      <h2 id="bid-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('freelance.gig.placeBid')}</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.gig.yourPrice').replace('{currency}', gig.currency)}</span>
        <input type="number" inputMode="numeric" min={1} required value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
        <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.gig.clientBudget').replace('{budget}', formatBudget(gig))}</span>
      </label>
      {validPrice && (
        <dl className="flex flex-col gap-2 rounded-lg bg-[#F1F4F6] p-3.5 text-sm dark:bg-slate-800">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500 dark:text-slate-300">{t('freelance.gig.clientPays')}</dt>
            <dd className="font-bold text-ink-900 dark:text-white">{money(price)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500 dark:text-slate-300">{t('freelance.gig.fee')}</dt>
            <dd className="font-bold text-ink-900 dark:text-white">− {money(fee)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-ink-200 pt-2 dark:border-slate-700">
            <dt className="font-bold text-ink-900 dark:text-white">{t('freelance.gig.youReceive')}</dt>
            <dd className="text-base font-bold text-forest dark:text-limeAccent">{money(price - fee)}</dd>
          </div>
        </dl>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.gig.deliveryDays')}</span>
        <input type="number" inputMode="numeric" min={1} required value={days} onChange={(event) => setDays(event.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.gig.coverLetter')}</span>
        <textarea
          rows={5}
          required
          value={letter}
          onChange={(event) => setLetter(event.target.value)}
          placeholder={t('freelance.gig.coverPlaceholder')}
          className={`${field} resize-y py-3 leading-normal`}
        />
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={sending} className={primary}>{t(sending ? 'freelance.gig.sending' : 'freelance.gig.submitBid')}</button>
      <p className="text-[13px] leading-normal text-ink-500 dark:text-slate-400">{t('freelance.gig.payNote')}</p>
    </form>
  );
}
