'use client';

import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { safeHttpUrl } from '@/features/jobs/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

type Report = {
  id: string;
  targetType: 'JOB' | 'FORUM_THREAD' | 'FORUM_REPLY';
  targetId: string;
  targetTitle: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: { firstName: string; lastName: string; email: string };
};
type CompanyRequest = {
  id: string;
  name: string;
  website: string | null;
  tradeLicenseUrl: string | null;
  verificationRequestedAt: string | null;
  user: { email: string };
};
type Dispute = {
  id: string;
  reason: string;
  resolvedAt: string | null;
  createdAt: string;
  contract: {
    id: string;
    agreedAmount: number;
    currency?: string;
    freelanceJob: { title: string };
    client: { firstName: string; lastName: string };
    freelancer: { firstName: string; lastName: string };
  };
};
type Transfer = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  createdAt: string;
  metadata?: { planId?: string } | null;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_URL}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.message === 'string' ? body.message : `Request failed (${response.status})`);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

const box = 'rounded-2xl border border-ink-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-900';
const button = 'rounded-lg border border-ink-300 px-3 py-2 text-sm font-bold text-ink-900 disabled:opacity-50 dark:border-slate-700 dark:text-white';
const primary = 'rounded-lg bg-obsidian px-3 py-2 text-sm font-bold text-white disabled:opacity-50 dark:bg-limeAccent dark:text-obsidian';
const name = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();

/**
 * Things waiting for an admin: reported content, trade licences, open disputes (which move
 * escrow money) and bank-transfer receipts (which start plans).
 */
export default function AdminReview() {
  const [reports, setReports] = useState<Report[]>([]);
  const [companies, setCompanies] = useState<CompanyRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<{ id: string; outcome: 'REFUND' | 'RELEASE' | 'SPLIT'; share: string; resolution: string } | null>(null);

  const load = useCallback(() => {
    call<Report[]>('/reports/admin').then(setReports).catch(() => setReports([]));
    call<CompanyRequest[]>('/admin/companies/verification').then(setCompanies).catch(() => setCompanies([]));
    call<Dispute[]>('/admin/escrow/disputes').then((rows) => setDisputes(rows.filter((row) => !row.resolvedAt))).catch(() => setDisputes([]));
    call<Transfer[]>('/manual-payment/admin?limit=50')
      .then((rows) => setTransfers(rows.filter((row) => row.status === 'PROCESSING')))
      .catch(() => setTransfers([]));
  }, []);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMessage('');
    try {
      await action();
      setMessage(done);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  async function openReceipt(id: string) {
    try {
      const { url } = await call<{ url: string }>(`/manual-payment/admin/${id}/receipt`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setMessage('Could not open the receipt.');
    }
  }

  return (
    <div className="space-y-6">
      {message && <p role="status" className="rounded-xl bg-brandGreen/10 p-3 text-sm font-semibold text-brandGreen">{message}</p>}

      <section className={box}>
        <h2 className="mb-3 text-lg font-black">Reported content ({reports.length})</h2>
        {reports.length === 0 && <p className="text-sm text-ink-500">Nothing reported.</p>}
        {reports.map((report) => (
          <div key={report.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-ink-200 py-3 dark:border-slate-800">
            <div className="min-w-0 flex-1 text-sm">
              <b>{report.targetTitle ?? '(removed)'}</b> <span className="text-ink-500">· {report.targetType.replace('_', ' ').toLowerCase()}</span>
              <p>Reason: {report.reason.replaceAll('_', ' ')}{report.details ? ` — ${report.details}` : ''}</p>
              <p className="text-ink-500">By {name(report.reporter)} ({report.reporter.email}) · {new Date(report.createdAt).toLocaleString()}</p>
              {report.targetType === 'JOB' && <a href={`/jobs/${report.targetId}`} target="_blank" rel="noreferrer" className="font-bold text-forest underline">Open job</a>}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy} className={button} onClick={() => run(() => call(`/reports/admin/${report.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'dismiss' }) }), 'Report dismissed.')}>Dismiss</button>
              <button type="button" disabled={busy} className={primary} onClick={() => window.confirm('Remove this content for everyone?') && run(() => call(`/reports/admin/${report.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'remove' }) }), 'Content removed.')}>Remove content</button>
            </div>
          </div>
        ))}
      </section>

      <section className={box}>
        <h2 className="mb-3 text-lg font-black">Trade licences to check ({companies.length})</h2>
        {companies.length === 0 && <p className="text-sm text-ink-500">None waiting.</p>}
        {companies.map((company) => {
          const licence = safeHttpUrl(company.tradeLicenseUrl);
          return (
            <div key={company.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-ink-200 py-3 dark:border-slate-800">
              <div className="min-w-0 flex-1 text-sm">
                <b>{company.name}</b> <span className="text-ink-500">· {company.user.email}</span>
                {licence && <p><a href={licence} target="_blank" rel="noreferrer" className="font-bold text-forest underline">Open licence</a></p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={button}
                  onClick={() => {
                    const note = window.prompt('Why is it rejected? The employer will see this.');
                    if (note?.trim()) run(() => call(`/admin/companies/${company.id}/verification`, { method: 'PATCH', body: JSON.stringify({ decision: 'REJECTED', note }) }), 'Licence rejected.');
                  }}
                >
                  Reject
                </button>
                <button type="button" disabled={busy} className={primary} onClick={() => run(() => call(`/admin/companies/${company.id}/verification`, { method: 'PATCH', body: JSON.stringify({ decision: 'VERIFIED' }) }), 'Company verified.')}>Verify</button>
              </div>
            </div>
          );
        })}
      </section>

      <section className={box}>
        <h2 className="mb-1 text-lg font-black">Open disputes ({disputes.length})</h2>
        <p className="mb-3 text-sm text-ink-500">Settling moves the money still held in escrow: to the client, to the freelancer (less the 10% fee), or split.</p>
        {disputes.length === 0 && <p className="text-sm text-ink-500">No open disputes.</p>}
        {disputes.map((dispute) => (
          <div key={dispute.id} className="border-t border-ink-200 py-3 text-sm dark:border-slate-800">
            <b>{dispute.contract.freelanceJob.title}</b>
            <p className="text-ink-500">
              Client {name(dispute.contract.client)} · Freelancer {name(dispute.contract.freelancer)} · {dispute.contract.currency ?? 'ETB'} {dispute.contract.agreedAmount.toLocaleString('en-US')}
            </p>
            <p className="my-1 whitespace-pre-line">{dispute.reason}</p>
            {settling?.id === dispute.id ? (
              <div className="mt-2 flex flex-col gap-2">
                <select value={settling.outcome} onChange={(e) => setSettling({ ...settling, outcome: e.target.value as 'REFUND' | 'RELEASE' | 'SPLIT' })} className="max-w-[260px] rounded-lg border border-ink-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-950">
                  <option value="REFUND">Refund the client</option>
                  <option value="RELEASE">Pay the freelancer</option>
                  <option value="SPLIT">Split</option>
                </select>
                {settling.outcome === 'SPLIT' && (
                  <input type="number" min={0} placeholder="Freelancer's share, before fee" value={settling.share} onChange={(e) => setSettling({ ...settling, share: e.target.value })} className="max-w-[260px] rounded-lg border border-ink-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                )}
                <textarea rows={2} placeholder="Decision both sides will see (at least 10 characters)" value={settling.resolution} onChange={(e) => setSettling({ ...settling, resolution: e.target.value })} className="rounded-lg border border-ink-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" />
                <div className="flex gap-2">
                  <button type="button" className={button} onClick={() => setSettling(null)}>Cancel</button>
                  <button
                    type="button"
                    disabled={busy || settling.resolution.trim().length < 10 || (settling.outcome === 'SPLIT' && !settling.share)}
                    className={primary}
                    onClick={() =>
                      window.confirm('This moves escrow money and cannot be undone. Settle?') &&
                      run(
                        () =>
                          call(`/admin/disputes/${dispute.id}/resolve`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              outcome: settling.outcome,
                              resolution: settling.resolution.trim(),
                              freelancerAmount: settling.outcome === 'SPLIT' ? Number(settling.share) : undefined,
                            }),
                          }).then(() => setSettling(null)),
                        'Dispute settled.',
                      )
                    }
                  >
                    Settle dispute
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={button} onClick={() => setSettling({ id: dispute.id, outcome: 'REFUND', share: '', resolution: '' })}>Settle</button>
            )}
          </div>
        ))}
      </section>

      <section className={box}>
        <h2 className="mb-3 text-lg font-black">Bank transfers to check ({transfers.length})</h2>
        {transfers.length === 0 && <p className="text-sm text-ink-500">No receipts waiting.</p>}
        {transfers.map((transfer) => (
          <div key={transfer.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 py-3 text-sm dark:border-slate-800">
            <span>
              <b>{transfer.currency} {(transfer.amount / 100).toLocaleString('en-US')}</b> · ref {transfer.transactionReference ?? '—'} · {new Date(transfer.createdAt).toLocaleString()}
              {transfer.metadata?.planId && <span className="text-ink-500"> · starts a plan</span>}
            </span>
            <span className="flex gap-2">
              <button type="button" className={button} onClick={() => openReceipt(transfer.id)}>Receipt</button>
              <button
                type="button"
                disabled={busy}
                className={button}
                onClick={() => {
                  const reason = window.prompt('Why is it rejected?');
                  if (reason !== null) run(() => call(`/manual-payment/admin/${transfer.id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }), 'Payment rejected.');
                }}
              >
                Reject
              </button>
              <button type="button" disabled={busy} className={primary} onClick={() => run(() => call(`/manual-payment/admin/${transfer.id}/approve`, { method: 'PATCH' }), 'Payment approved.')}>Approve</button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
