'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { authenticatedFetch } from '@/lib/auth';
import { fetchPlans } from '@/lib/api';
import { apiGet, apiSend } from '../api';
import { card, Field, input, muted, outline, shortDate, solid } from '../ui';
import { errorText, apiError } from '@/lib/api-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
/** Account name, bank and number to pay into; set per deployment, never guessed. */
const BANK_DETAILS = process.env.NEXT_PUBLIC_BANK_TRANSFER_DETAILS ?? '';

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  transactionReference: string | null;
  metadata?: { planId?: string } | null;
  createdAt: string;
};
type PaidPlan = { id: string; name: string; priceAmount: number; currency: string };

/**
 * Pay for a plan by bank transfer: pick the plan, transfer the amount, then send the receipt and
 * the bank's reference. An admin checks it and the plan starts. Below it, every payment so far.
 */
export default function BankTransfer() {
  const { t, locale } = useTranslation();
  const [plans, setPlans] = useState<PaidPlan[]>([]);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [planId, setPlanId] = useState('');
  const [pending, setPending] = useState<Payment | null>(null);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    fetchPlans()
      .then((rows) => setPlans((rows as unknown as PaidPlan[]).filter((plan) => plan.priceAmount > 0)))
      .catch(() => setPlans([]));
    apiGet<Payment[]>('/manual-payment/mine')
      .then((rows) => {
        setPayments(rows);
        setPending(rows.find((row) => row.status === 'PENDING') ?? null);
      })
      .catch(() => setPayments([]));
  }, []);
  useEffect(load, [load]);

  const planName = (payment: Payment) => plans.find((plan) => plan.id === payment.metadata?.planId)?.name;
  // Plan prices and plan payments are kept in santim.
  const money = (amount: number, currency: string) => `${currency} ${(amount / 100).toLocaleString('en-US')}`;

  async function start() {
    if (!planId) return;
    setBusy(true);
    setError('');
    try {
      setPending(await apiSend<Payment>('POST', '/manual-payment', { planId }));
    } catch (problem) {
      setError(errorText(problem, t, 'emp.bank.startFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function sendReceipt(event: FormEvent) {
    event.preventDefault();
    if (!pending || !reference.trim() || !receipt) {
      setError(t('emp.bank.needBoth'));
      return;
    }
    if (receipt.size > 10 * 1024 * 1024) {
      setError(t('emp.fileTooBig'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('paymentId', pending.id);
      form.append('transactionReference', reference.trim());
      form.append('receipt', receipt);
      const response = await authenticatedFetch(`${API_URL}/manual-payment/submit-receipt`, { method: 'POST', body: form });
      if (!response.ok) throw await apiError(response);
      setNotice(t('emp.bank.sent'));
      setPending(null);
      setReference('');
      setReceipt(null);
      load();
    } catch (problem) {
      setError(errorText(problem, t, 'emp.bank.receiptFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={`${card} flex flex-col gap-3`} aria-labelledby="bank-h">
        <h2 id="bank-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('emp.bank.title')}</h2>
        <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('emp.bank.text')}</p>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{notice}</p>}

        {pending ? (
          <form noValidate onSubmit={sendReceipt} className="flex flex-col gap-3">
            <div className="rounded-lg bg-[#F6F7F4] p-3.5 text-sm dark:bg-slate-800">
              <b className="block text-ink-900 dark:text-white">{t('emp.bank.pay').replace('{amount}', money(pending.amount, pending.currency))}</b>
              {BANK_DETAILS ? (
                <span className="whitespace-pre-line text-ink-700 dark:text-slate-300">{BANK_DETAILS}</span>
              ) : (
                <span className="text-ink-700 dark:text-slate-300">
                  {t('emp.bank.askDetails')} <Link href="/contact" className="font-bold text-forest hover:underline dark:text-limeAccent">{t('pricing.contact')}</Link>
                </span>
              )}
            </div>
            <Field label={t('emp.bank.reference')}>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={input} />
            </Field>
            <Field label={t('emp.bank.receipt')}>
              <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="text-sm text-ink-700 dark:text-slate-300" />
            </Field>
            <button type="submit" disabled={busy} className={`${solid} self-start`}>{t(busy ? 'emp.uploading' : 'emp.bank.send')}</button>
          </form>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t('emp.bank.plan')}>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={`${input} min-w-[220px]`}>
                <option value="">{t('emp.bank.choose')}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{`${plan.name} · ${money(plan.priceAmount, plan.currency)}`}</option>
                ))}
              </select>
            </Field>
            <button type="button" onClick={start} disabled={!planId || busy} className={outline}>{t('emp.bank.start')}</button>
          </div>
        )}
      </section>

      <section className={`${card} flex flex-col gap-2`} aria-labelledby="bill-h">
        <h2 id="bill-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('emp.bank.history')}</h2>
        {payments === null ? null : payments.length === 0 ? (
          <p className={muted}>{t('emp.bank.noPayments')}</p>
        ) : (
          <ul className="flex flex-col">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F4F6] py-2.5 text-sm dark:border-slate-800">
                <span className="flex flex-col gap-0.5">
                  <b className="text-ink-900 dark:text-white">{planName(payment) ?? t('emp.bank.payment')}</b>
                  <span className={muted}>{[shortDate(payment.createdAt, locale), payment.transactionReference].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex items-center gap-3">
                  <b className="text-ink-900 dark:text-white">{money(payment.amount, payment.currency)}</b>
                  <span className="rounded-md bg-[#F1F4F6] px-2 py-0.5 text-xs font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-200">{t(`emp.bank.status.${payment.status}`)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
