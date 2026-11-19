'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';

export const card = 'rounded-xl border border-ink-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-900';
export const solid = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-obsidian px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';
export const outline = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-300 bg-surface px-4 text-sm font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
export const input = 'min-h-12 w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
export const muted = 'text-[13px] text-ink-500 dark:text-slate-400';
export const link = 'font-bold text-forest hover:underline dark:text-limeAccent';

export function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink-900 md:text-[28px] dark:text-white">{title}</h1>
      {sub && <p className="text-[15px] text-ink-500 dark:text-slate-300">{sub}</p>}
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center gap-2 py-10 text-center`}>
      <b className="text-[17px] text-ink-900 dark:text-white">{title}</b>
      {text && <span className="max-w-[420px] text-sm text-ink-500 dark:text-slate-300">{text}</span>}
      {children}
    </div>
  );
}

export function Failed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={`${card} flex flex-col items-center gap-3 py-10 text-center`}>
      <b className="text-[17px] text-ink-900 dark:text-white">{t('dash.failed')}</b>
      <button type="button" onClick={onRetry} className={outline}>{t('freelance.retry')}</button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-bold text-ink-900 dark:text-white">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-forest dark:bg-limeAccent' : 'bg-ink-300 dark:bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all dark:bg-obsidian ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export function Confirm({ title, text, cancel, confirm, busy, onCancel, onConfirm }: {
  title: string;
  text: string;
  cancel: string;
  confirm: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-h" aria-describedby="confirm-d" className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-xl bg-surface p-6 dark:bg-slate-900">
        <h2 id="confirm-h" className="text-[19px] font-extrabold text-ink-900 dark:text-white">{title}</h2>
        <p id="confirm-d" className="text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{text}</p>
        <span className="flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className={outline}>{cancel}</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={solid}>{confirm}</button>
        </span>
      </div>
    </div>
  );
}

export const shortDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short' });
