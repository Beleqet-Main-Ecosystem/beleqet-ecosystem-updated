'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

/* Same classes as the website dashboard (beleqet-jobs-nextjs/features/dashboard/ui.tsx). */
export const card = 'rounded-xl border border-ink-200 bg-surface p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900';
export const solid = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-obsidian px-4 text-sm font-bold text-white disabled:opacity-50 dark:bg-limeAccent dark:text-obsidian';
export const outline = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink-300 bg-surface px-4 text-sm font-bold text-ink-900 hover:bg-ink-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800';
export const danger = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50';
export const input = 'min-h-10 w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-limeAccent';
export const muted = 'text-[13px] text-ink-500 dark:text-slate-400';
export const link = 'font-bold text-forest hover:underline dark:text-limeAccent';
export const row = 'flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-ink-100 py-3 first:border-t-0 dark:border-slate-800';

export function Heading({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">{title}</h1>
        {sub && <p className="text-sm text-ink-500 dark:text-slate-300">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center">
      <b className="text-ink-900 dark:text-white">{title}</b>
      {text && <span className="max-w-[420px] text-sm text-ink-500 dark:text-slate-400">{text}</span>}
    </div>
  );
}

export function Failed({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <b className="text-ink-900 dark:text-white">{message || t('common.failed')}</b>
      <button type="button" onClick={onRetry} className={outline}>{t('common.retry')}</button>
    </div>
  );
}

export function Loading() {
  const { t } = useI18n();
  return <p role="status" className="py-10 text-center text-sm text-ink-500 dark:text-slate-400">{t('common.loading')}</p>;
}

/** A success or error line after an action. */
export function Notice({ notice, onClose }: { notice: { kind: 'ok' | 'error'; text: string } | null; onClose: () => void }) {
  const { t } = useI18n();
  if (!notice) return null;
  const tone = notice.kind === 'ok'
    ? 'border-forest/30 bg-forest/10 text-forest dark:border-limeAccent/30 dark:bg-limeAccent/10 dark:text-limeAccent'
    : 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200';
  return (
    <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold ${tone}`}>
      <span>{notice.text}</span>
      <button type="button" onClick={onClose} aria-label={t('common.close')} className="shrink-0 font-bold">×</button>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm font-bold text-ink-900 dark:text-white">{label}</span>
      {children}
      {hint && <span className={muted}>{hint}</span>}
    </label>
  );
}

const tones = {
  green: 'bg-forest/10 text-forest dark:bg-limeAccent/15 dark:text-limeAccent',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  gray: 'bg-ink-100 text-ink-700 dark:bg-slate-800 dark:text-slate-300',
};
export type Tone = keyof typeof tones;

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

/** A modal that asks before an action; extra inputs go in `children`. */
export function Dialog({
  title,
  text,
  confirm,
  tone = 'solid',
  busy,
  disabled,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  text?: string;
  confirm: string;
  tone?: 'solid' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onCancel();
    document.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/70 p-4" onClick={() => !busy && onCancel()}>
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-5 sm:p-6 dark:bg-slate-900"
      >
        <h2 id={`${id}-t`} className="text-lg font-extrabold text-ink-900 dark:text-white">{title}</h2>
        {text && <p className="text-sm leading-relaxed text-ink-700 dark:text-slate-300">{text}</p>}
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={outline}>{t('common.cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={busy || disabled} className={tone === 'danger' ? danger : solid}>
            {busy ? t('common.working') : confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  const { t } = useI18n();
  if (total === 0) return null;
  return (
    <nav aria-label={t('common.pages')} className="flex flex-wrap items-center justify-between gap-3 pt-3">
      <span className={muted}>{t('common.pageOf', { page, pages, total })}</span>
      <span className="flex gap-2">
        <button type="button" className={outline} disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('common.previous')}</button>
        <button type="button" className={outline} disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('common.next')}</button>
      </span>
    </nav>
  );
}

/** Tabs that filter a list; one row, scrolls sideways on a phone. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${value === option.value ? 'bg-obsidian text-white dark:bg-limeAccent dark:text-obsidian' : 'text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Loads data and reloads when `key` changes. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    loader.current(controller.signal)
      .then((result) => !controller.signal.aborted && setData(result))
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : String(failure));
      });
    return () => controller.abort();
  }, [key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading: data === null && error === null, reload, setData };
}

/** Runs an admin action, reporting success or the API's reason. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>, done: string): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ kind: 'ok', text: done });
      return true;
    } catch (failure) {
      setNotice({ kind: 'error', text: failure instanceof Error ? failure.message : String(failure) });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, notice, setNotice, run };
}

/** Waits until typing stops before searching. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
