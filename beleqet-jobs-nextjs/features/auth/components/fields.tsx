'use client';

import { useId, useState } from 'react';
import { useTranslation } from '@/lib/i18n';

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';
const inputBase =
  'min-h-12 w-full min-w-0 rounded-md border bg-surface px-3.5 text-base text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-forest dark:bg-slate-900 dark:text-white';

export function Heading({ title, sub, eyebrow }: { title: string; sub?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow}
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 md:text-[30px] dark:text-white">{title}</h1>
      {sub && <p className="text-[15px] leading-relaxed text-ink-600 dark:text-slate-400">{sub}</p>}
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  labelAction?: React.ReactNode;
};

export function TextField({ label, hint, error, labelAction, className, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className ?? ''}`}>
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-900 dark:text-white">{label}</label>
        {labelAction}
      </span>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputBase} ${error ? 'border-[#B42318]' : 'border-ink-300 dark:border-slate-700'}`}
        {...input}
      />
      {hint && !error && <span id={`${id}-hint`} className="text-[13px] text-ink-600 dark:text-slate-400">{hint}</span>}
      {error && <span id={`${id}-err`} className="text-[13px] font-semibold text-[#B42318]">{error}</span>}
    </div>
  );
}

export function PasswordField({ label, hint, error, labelAction, ...input }: FieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const [shown, setShown] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-900 dark:text-white">{label}</label>
        {labelAction}
      </span>
      <span
        className={`flex items-center rounded-md border bg-surface focus-within:ring-2 focus-within:ring-forest dark:bg-slate-900 ${
          error ? 'border-[#B42318]' : 'border-ink-300 dark:border-slate-700'
        }`}
      >
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-h-[46px] min-w-0 flex-1 rounded-md bg-transparent px-3.5 text-base text-ink-900 focus:outline-none dark:text-white"
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-pressed={shown}
          aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
          className={`min-h-11 rounded-md px-3.5 text-sm font-bold text-forest dark:text-limeAccent ${focusRing}`}
        >
          {shown ? t('auth.hide') : t('auth.show')}
        </button>
      </span>
      {hint && !error && <span id={`${id}-hint`} className="text-[13px] text-ink-600 dark:text-slate-400">{hint}</span>}
      {error && <span id={`${id}-err`} className="text-[13px] font-semibold text-[#B42318]">{error}</span>}
    </div>
  );
}

export function SubmitButton({ busy, busyLabel, children, disabled }: { busy?: boolean; busyLabel?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={`min-h-[50px] rounded-md bg-primary text-base font-extrabold text-limeAccent transition-colors hover:bg-primary2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian ${focusRing}`}
    >
      {busy ? busyLabel ?? children : children}
    </button>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border border-[#F4B8B2] bg-[#FDECEC] px-3.5 py-3 text-sm font-semibold text-[#9B2C2C]">
      {message}
    </p>
  );
}

export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-[50px] rounded-md border border-ink-300 bg-surface text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
    >
      {children}
    </button>
  );
}
