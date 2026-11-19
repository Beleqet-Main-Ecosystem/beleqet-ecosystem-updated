'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { safeHttpUrl } from '@/features/jobs/format';
import { uploadAttachment } from '../actions';
import { addMilestone, releaseMilestone, requestRevision, submitWork, type Milestone } from '../contract';
import { errorText } from '@/lib/api-error';

export type DialogRequest =
  | { kind: 'release' | 'revision'; milestone: Milestone }
  | { kind: 'submit'; milestone: Milestone; number: number }
  | { kind: 'add'; left: number };

type Props = {
  request: DialogRequest;
  contractId: string;
  freelancerName: string;
  currency: string;
  onClose: () => void;
  onDone: () => void;
};

const field = 'min-h-12 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelText = 'text-sm font-semibold text-ink-900 dark:text-white';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FEE = 0.1;

export default function MilestoneDialog({ request, contractId, freelancerName, currency, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const money = (value: number) => `${currency} ${value.toLocaleString('en-US')}`;
  const heading =
    request.kind === 'release' ? t('freelance.contract.releaseTitle')
    : request.kind === 'revision' ? t('freelance.contract.revisionTitle')
    : request.kind === 'submit' ? t('freelance.contract.submitTitle').replace('{number}', String(request.number))
    : t('freelance.contract.addMilestone');
  const confirm =
    request.kind === 'release' ? t('freelance.contract.releaseConfirm').replace('{amount}', money(request.milestone.amount))
    : request.kind === 'revision' ? t('freelance.contract.sendRequest')
    : request.kind === 'submit' ? t('freelance.contract.submitConfirm')
    : t('freelance.contract.addConfirm');

  async function run() {
    setError('');
    if (request.kind === 'revision' && !text.trim()) return setError(t('freelance.contract.errRevision'));
    if (request.kind === 'submit') {
      if (!text.trim()) return setError(t('freelance.contract.errNotes'));
      if (link.trim() && !safeHttpUrl(link)) return setError(t('job.apply.portfolioInvalid'));
      if (file && file.size > MAX_FILE_BYTES) return setError(t('freelance.post2.fileTooBig'));
    }
    if (request.kind === 'add') {
      const value = Number(amount);
      if (title.trim().length < 3 || !deadline) return setError(t('freelance.contract.errMilestone'));
      if (!(value >= 1) || value > request.left) return setError(t('freelance.contract.errAmount').replace('{left}', money(request.left)));
    }
    setBusy(true);
    try {
      if (request.kind === 'release') await releaseMilestone(request.milestone.id);
      if (request.kind === 'revision') await requestRevision(request.milestone.id, text.trim());
      if (request.kind === 'submit') {
        const fileUrl = file ? await uploadAttachment(file) : safeHttpUrl(link) ?? undefined;
        await submitWork(request.milestone.id, { fileUrl, notes: text.trim() });
      }
      if (request.kind === 'add') {
        await addMilestone(contractId, { title: title.trim(), amount: Math.round(Number(amount)), deadline: new Date(deadline).toISOString() });
      }
      onDone();
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
      setBusy(false);
    }
  }

  const fee = request.kind === 'release' ? Math.round(request.milestone.amount * FEE) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-h" className="flex max-h-full w-full max-w-[480px] flex-col gap-3.5 overflow-y-auto rounded-xl bg-surface p-6 dark:bg-slate-900">
        <h2 id="dlg-h" className="text-[19px] font-extrabold text-ink-900 dark:text-white">{heading}</h2>

        {request.kind === 'release' && (
          <>
            <dl className="flex flex-col gap-2 rounded-lg bg-[#F1F4F6] p-3.5 text-sm dark:bg-slate-800">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500 dark:text-slate-300">{t('freelance.contract.releasedFrom')}</dt>
                <dd className="font-bold text-ink-900 dark:text-white">{money(request.milestone.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500 dark:text-slate-300">{t('freelance.gig.fee')}</dt>
                <dd className="font-bold text-ink-900 dark:text-white">− {money(fee)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-ink-200 pt-2 dark:border-slate-700">
                <dt className="font-bold text-ink-900 dark:text-white">{t('freelance.contract.receives').replace('{name}', freelancerName)}</dt>
                <dd className="font-bold text-forest dark:text-limeAccent">{money(request.milestone.amount - fee)}</dd>
              </div>
            </dl>
            <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('freelance.contract.releaseNote')}</p>
          </>
        )}

        {request.kind === 'revision' && (
          <label className="flex flex-col gap-1.5">
            <span className={labelText}>{t('freelance.contract.whatChange')}</span>
            <textarea autoFocus rows={4} value={text} onChange={(event) => setText(event.target.value)} className={`${field} resize-y py-3`} />
          </label>
        )}

        {request.kind === 'submit' && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.workLink')}</span>
              <input autoFocus type="url" inputMode="url" placeholder="https://…" value={link} disabled={Boolean(file)} onChange={(event) => setLink(event.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.workFile')}</span>
              <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-sm text-ink-700 dark:text-slate-300" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.notes')}</span>
              <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} className={`${field} resize-y py-3`} />
            </label>
          </>
        )}

        {request.kind === 'add' && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.milestoneTitle')}</span>
              <input autoFocus type="text" value={title} onChange={(event) => setTitle(event.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.amount').replace('{currency}', currency)}</span>
              <input type="number" inputMode="numeric" min={1} max={request.left} value={amount} onChange={(event) => setAmount(event.target.value)} className={field} />
              <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.contract.left').replace('{left}', money(request.left))}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelText}>{t('freelance.contract.dueDate')}</span>
              <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={field} />
            </label>
          </>
        )}

        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        <span className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-3.5 text-sm font-bold text-ink-900 dark:border-slate-700 dark:text-white">{t('freelance.gig.cancel')}</button>
          <button type="button" disabled={busy} onClick={run} className="inline-flex min-h-11 items-center rounded-lg bg-obsidian px-3.5 text-sm font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian">{confirm}</button>
        </span>
      </div>
    </div>
  );
}
