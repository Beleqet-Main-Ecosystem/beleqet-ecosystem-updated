'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '../api';
import { card, Failed, Field, Heading, input, muted, shortDate, solid } from '../ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

type WalletTx = { id: string; type: string; amount: number; note: string | null; createdAt: string };
type WalletData = { availableBalance: number; pendingBalance: number; currency: string; transactions: WalletTx[] };
type Bank = { code: string; name: string; accountLength: number | null; mobileMoney: boolean };

/** POST that keeps the API's error body, which says when a two-step code is needed. */
async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await authenticatedFetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const messageOf = (data: { message?: unknown }) =>
  Array.isArray(data.message) ? data.message.join(', ') : typeof data.message === 'string' ? data.message : '';

/** A withdrawal's state lives in its note: sent, failed (money returned) or still processing. */
function withdrawalState(note: string | null): 'sent' | 'failed' | 'processing' {
  if (!note) return 'processing';
  if (/WITHDRAWAL_SUBMITTED|transfer submitted/i.test(note)) return 'sent';
  if (/WITHDRAWAL_FAILED|Withdrawal FAILED/i.test(note)) return 'failed';
  return 'processing';
}

/** A freelancer's earnings: what is available, what is on hold, and withdrawing through Chapa. */
export default function Wallet() {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [failed, setFailed] = useState(false);

  const [bankCode, setBankCode] = useState('');
  const [accountName, setAccountName] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : '');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setWallet(await apiGet<WalletData>('/wallet'));
    } catch {
      setFailed(true);
    }
    apiGet<Bank[]>('/wallet/banks').then(setBanks).catch(() => setBanks([]));
  }, []);
  useEffect(() => void load(), [load]);

  const bank = banks?.find((b) => b.code === bankCode);
  const money = (value: number) => `${wallet?.currency ?? 'ETB'} ${value.toLocaleString('en-US')}`;

  async function withdraw(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const value = Number(amount);
    const digits = accountNumber.replace(/[\s-]/g, '');
    if (!bank) return setError(t('dash.wallet.pickBank'));
    if (accountName.trim().length < 2) return setError(t('dash.wallet.needName'));
    if (bank.accountLength && digits.length !== bank.accountLength) {
      return setError(t('dash.wallet.badLength').replace('{bank}', bank.name).replace('{n}', String(bank.accountLength)));
    }
    if (!Number.isInteger(value) || value < 1) return setError(t('dash.wallet.badAmount'));
    if (wallet && value > wallet.availableBalance) return setError(t('dash.wallet.tooMuch'));
    if (needsCode && !/^\d{6}$/.test(code.trim())) return setError(t('dash.wallet.needCode'));

    setBusy(true);
    try {
      const headers: Record<string, string> = {};
      if (needsCode) {
        // Two-step sign-in is on: trade the 6-digit code for a short-lived withdrawal pass.
        const challenge = await post('/auth/2fa/challenge', { action: 'wallet_withdraw' });
        const verified = challenge.ok
          ? await post('/auth/2fa/step-up', { stepUpToken: challenge.data.stepUpToken, code: code.trim(), action: 'wallet_withdraw' })
          : challenge;
        if (!verified.ok) {
          setError(messageOf(verified.data) || t('dash.wallet.codeWrong'));
          return;
        }
        headers['x-step-up-token'] = verified.data.stepUpToken;
      }
      const result = await post('/wallet/withdraw', { amount: value, bankCode, accountName: accountName.trim(), accountNumber: digits, currency: 'ETB' }, headers);
      if (result.status === 401 && result.data?.requiresStepUp) {
        setNeedsCode(true);
        setError(t('dash.wallet.enterCode'));
        return;
      }
      if (!result.ok) {
        setError(messageOf(result.data) || t('dash.wallet.failed'));
        return;
      }
      setNotice(t('dash.wallet.sent').replace('{amount}', money(value)).replace('{bank}', bank.name));
      setAmount('');
      setCode('');
      setNeedsCode(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (failed) return <Failed onRetry={load} />;
  if (!wallet) return <div className="min-h-[40vh]" />;

  return (
    <>
      <Heading title={t('dash.tabs.wallet')} sub={t('dash.wallet.sub')} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${card} flex flex-col gap-1`}>
          <span className={muted}>{t('dash.wallet.available')}</span>
          <b className="text-[26px] font-extrabold text-ink-900 dark:text-white">{money(wallet.availableBalance)}</b>
        </div>
        <div className={`${card} flex flex-col gap-1`}>
          <span className={muted}>{t('dash.wallet.onHold')}</span>
          <b className="text-[26px] font-extrabold text-ink-900 dark:text-white">{money(wallet.pendingBalance)}</b>
          <span className={muted}>{t('dash.wallet.onHoldText')}</span>
        </div>
      </div>

      <section className={`${card} flex flex-col gap-3`} aria-labelledby="withdraw-h">
        <h2 id="withdraw-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.wallet.withdrawTitle')}</h2>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{notice}</p>}
        {banks && banks.length === 0 ? (
          <p className={muted}>{t('dash.wallet.noBanks')}</p>
        ) : (
          <form noValidate onSubmit={withdraw} className="flex flex-col gap-3">
            <Field label={t('dash.wallet.bank')}>
              <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={input}>
                <option value="">{t('dash.wallet.chooseBank')}</option>
                {(banks ?? []).map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('dash.wallet.accountName')}>
              <input type="text" autoComplete="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className={input} />
            </Field>
            <Field label={t(bank?.mobileMoney ? 'dash.wallet.phone' : 'dash.wallet.accountNumber')}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={bank?.accountLength ? t('dash.wallet.digits').replace('{n}', String(bank.accountLength)) : ''}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={input}
              />
            </Field>
            <Field label={t('dash.wallet.amount')}>
              <input type="number" inputMode="numeric" min={1} max={wallet.availableBalance} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
            </Field>
            {needsCode && (
              <Field label={t('dash.wallet.code')}>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className={input} />
              </Field>
            )}
            <button type="submit" disabled={busy || wallet.availableBalance < 1} className={`${solid} self-start`}>
              {t('dash.wallet.withdraw')}
            </button>
            <p className={muted}>{t('dash.wallet.checkName')}</p>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="history-h">
        <h2 id="history-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.wallet.history')}</h2>
        {wallet.transactions.length === 0 ? (
          <p className={muted}>{t('dash.wallet.noHistory')}</p>
        ) : (
          wallet.transactions.map((tx) => {
            const out = tx.type.startsWith('DEBIT');
            const state = tx.type === 'DEBIT_WITHDRAWAL' ? withdrawalState(tx.note) : null;
            return (
              <div key={tx.id} className={`${card} flex flex-wrap items-center justify-between gap-2 py-3`}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="text-ink-900 dark:text-white">{t(`dash.wallet.type.${tx.type}`)}</b>
                  <span className={muted}>
                    {shortDate(tx.createdAt, locale)}
                    {state ? ` · ${t(`dash.wallet.state.${state}`)}` : ''}
                  </span>
                </span>
                <b className={out ? 'text-ink-900 dark:text-white' : 'text-forest dark:text-limeAccent'}>
                  {out ? '−' : '+'} {money(tx.amount)}
                </b>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
