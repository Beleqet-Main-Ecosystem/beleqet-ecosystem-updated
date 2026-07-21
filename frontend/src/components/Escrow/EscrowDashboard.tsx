import { FormEvent, useMemo, useState } from 'react';

const currencies = ['ETB', 'USD', 'EUR'];
const paymentStatuses = ['success', 'failed', 'pending'];

type EscrowInitiationResult = {
  escrowId: string;
  checkoutUrl?: string | null;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  walletAppliedAmount: number;
  amountToPay?: number;
};

type MilestoneConfirmationResult = {
  success: boolean;
  released: boolean;
  waitingFor?: 'EMPLOYER' | 'FREELANCER';
  alreadyReleased?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getAccessToken() {
  return localStorage.getItem('access_token') || localStorage.getItem('accessToken');
}

async function apiRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.message === 'string' ? data.message : 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

function ResultPanel({
  initiation,
  confirmation,
  callbackResult,
}: {
  initiation: EscrowInitiationResult | null;
  confirmation: MilestoneConfirmationResult | null;
  callbackResult: Record<string, unknown> | null;
}) {
  if (!initiation && !confirmation && !callbackResult) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      {initiation && (
        <div className="mb-4 last:mb-0">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">C</span>
            <span>Escrow initialized</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <span>Escrow ID: {initiation.escrowId}</span>
            <span>Gross: {initiation.grossAmount}</span>
            <span>Platform fee: {initiation.platformFee}</span>
            <span>Wallet applied: {initiation.walletAppliedAmount}</span>
          </div>
          {initiation.checkoutUrl && (
            <a
              href={initiation.checkoutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-blue-700 hover:text-blue-900"
            >
              <span aria-hidden="true">L</span>
              Open Chapa checkout
            </a>
          )}
        </div>
      )}

      {confirmation && (
        <div className="mb-4 last:mb-0">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">{confirmation.released ? 'A' : 'W'}</span>
            <span>
              {confirmation.released ? 'Milestone queued for release' : 'Confirmation recorded'}
            </span>
          </div>
          {!confirmation.released && confirmation.waitingFor && (
            <p>Waiting for {confirmation.waitingFor.toLowerCase()} confirmation.</p>
          )}
        </div>
      )}

      {callbackResult && (
        <div>
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
            <span aria-hidden="true">Q</span>
            <span>Callback queued</span>
          </div>
          <pre className="overflow-auto rounded bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(callbackResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function EscrowDashboard() {
  const [gigId, setGigId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [note, setNote] = useState('');
  const [txRef, setTxRef] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [status, setStatus] = useState('success');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initiation, setInitiation] = useState<EscrowInitiationResult | null>(null);
  const [confirmation, setConfirmation] = useState<MilestoneConfirmationResult | null>(null);
  const [callbackResult, setCallbackResult] = useState<Record<string, unknown> | null>(null);

  const canSendCallback = useMemo(() => txRef.trim() || reference.trim(), [txRef, reference]);

  async function handleInitiate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading('initiate');
    setError(null);
    try {
      setInitiation(await apiRequest<EscrowInitiationResult>(`/escrow/initiate/${gigId.trim()}`));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not initiate escrow.'));
    } finally {
      setLoading(null);
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading('confirm');
    setError(null);
    try {
      setConfirmation(
        await apiRequest<MilestoneConfirmationResult>(
          `/escrow/milestones/${milestoneId.trim()}/confirm`,
          note.trim() ? { note: note.trim() } : {},
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm milestone.'));
    } finally {
      setLoading(null);
    }
  }

  async function handleCallback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading('callback');
    setError(null);
    try {
      const payload = {
        event: status === 'success' ? 'charge.success' : 'charge.updated',
        tx_ref: txRef.trim(),
        reference: reference.trim(),
        status,
        amount: amount ? Number(amount) : undefined,
        currency,
      };
      setCallbackResult(await apiRequest<Record<string, unknown>>('/escrow/callback', payload));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not queue callback.'));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Chapa Escrow</h2>
          <p className="text-sm text-gray-500">Fund, verify, and confirm milestone release.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span aria-hidden="true">V</span>
          Verified before funding
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={handleInitiate} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span aria-hidden="true">C</span>
            <span>Fund escrow</span>
          </div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="escrow-gig-id">
            Gig ID
          </label>
          <input
            id="escrow-gig-id"
            value={gigId}
            onChange={(event) => setGigId(event.target.value)}
            placeholder="freelance job id"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!gigId.trim() || loading === 'initiate'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <span aria-hidden="true">C</span>
            {loading === 'initiate' ? 'Starting...' : 'Initialize'}
          </button>
        </form>

        <form onSubmit={handleConfirm} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span aria-hidden="true">M</span>
            <span>Confirm milestone</span>
          </div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="escrow-milestone-id"
          >
            Milestone ID
          </label>
          <input
            id="escrow-milestone-id"
            value={milestoneId}
            onChange={(event) => setMilestoneId(event.target.value)}
            placeholder="milestone id"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="escrow-note">
            Note
          </label>
          <textarea
            id="escrow-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="optional"
            className="mb-4 h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!milestoneId.trim() || loading === 'confirm'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <span aria-hidden="true">M</span>
            {loading === 'confirm' ? 'Saving...' : 'Confirm'}
          </button>
        </form>

        <form onSubmit={handleCallback} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span aria-hidden="true">Q</span>
            <span>Queue callback</span>
          </div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="escrow-tx-ref">
            Transaction ref
          </label>
          <input
            id="escrow-tx-ref"
            value={txRef}
            onChange={(event) => setTxRef(event.target.value)}
            placeholder="tx_ref"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="escrow-reference"
          >
            Chapa reference
          </label>
          <input
            id="escrow-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="reference"
            className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Payment status"
            >
              {paymentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Currency"
            >
              {currencies.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <label
            className="mb-1 mt-3 block text-sm font-medium text-gray-700"
            htmlFor="escrow-amount"
          >
            Amount
          </label>
          <input
            id="escrow-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="optional"
            inputMode="decimal"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!canSendCallback || loading === 'callback'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
          >
            <span aria-hidden="true">Q</span>
            {loading === 'callback' ? 'Queueing...' : 'Queue'}
          </button>
        </form>
      </div>

      <div className="mt-6">
        <ResultPanel
          initiation={initiation}
          confirmation={confirmation}
          callbackResult={callbackResult}
        />
      </div>
    </div>
  );
}
