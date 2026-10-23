'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle2, Shield, X, Clock, Banknote } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

export default function FreelanceBidActions({
  gigId,
  gigTitle,
  budgetDefault,
}: {
  gigId: string;
  gigTitle: string;
  budgetDefault?: number;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function startProposal() {
    if (!ready) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/freelance/${gigId}`)}`);
      return;
    }
    setError('');
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const timelineDays = Number(form.get('timelineDays'));
    const coverLetter = form.get('coverLetter')?.toString() || '';

    try {
      const response = await authenticatedFetch(`${API_URL}/freelance/jobs/${gigId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          timelineDays,
          coverLetter,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Could not submit proposal. Please try again.',
        );
      }

      setSubmitted(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit proposal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-6 space-y-3">
        <button
          onClick={startProposal}
          disabled={submitted || !ready}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brandGreen py-3.5 text-sm font-bold text-white transition-colors hover:bg-darkGreen disabled:opacity-60 shadow-sm"
        >
          {submitted ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {submitted ? 'Proposal submitted' : 'Submit proposal'}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted dark:text-slate-400">
          <Shield className="h-3.5 w-3.5 text-brandGreen" />
          <span>Payment secured by Beleqet Escrow</span>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-primary/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proposal-title"
        >
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#f7f5ef] shadow-2xl sm:rounded-[28px] dark:bg-slate-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-brandGreen">
                  Freelance Proposal
                </p>
                <h2 id="proposal-title" className="mt-1 text-lg font-black text-primary dark:text-white line-clamp-1">
                  {gigTitle}
                </h2>
              </div>
              <button
                onClick={() => !submitting && setOpen(false)}
                aria-label="Close proposal form"
                className="rounded-full p-2 text-muted hover:bg-pageBg dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-ink dark:text-slate-200">
                  <span className="flex items-center gap-1 mb-1.5">
                    <Banknote className="h-3.5 w-3.5 text-brandGreen" /> Your bid amount (ETB)
                  </span>
                  <input
                    name="amount"
                    type="number"
                    required
                    min={1}
                    defaultValue={budgetDefault || 10000}
                    className="w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-brandGreen dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </label>

                <label className="block text-xs font-bold text-ink dark:text-slate-200">
                  <span className="flex items-center gap-1 mb-1.5">
                    <Clock className="h-3.5 w-3.5 text-brandGreen" /> Delivery time (days)
                  </span>
                  <input
                    name="timelineDays"
                    type="number"
                    required
                    min={1}
                    max={365}
                    defaultValue={14}
                    className="w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-brandGreen dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold text-ink dark:text-slate-200">
                Cover letter & Proposal pitch
                <textarea
                  name="coverLetter"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={6}
                  placeholder="Explain your approach, tools you will use, and why you are the best fit for this project…"
                  className="mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-brandGreen dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-full border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary dark:border-slate-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brandGreen px-6 py-2.5 text-sm font-bold text-white hover:bg-darkGreen disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Submitting…' : 'Send proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
