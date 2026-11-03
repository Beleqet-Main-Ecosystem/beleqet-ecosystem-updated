'use client';

import { useState, type FormEvent } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const FIELDS = ['name', 'industry', 'location'] as const;
const input = 'min-h-12 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelText = 'text-sm font-bold text-ink-900 dark:text-white';

/** Every job belongs to a company, so a new employer sets one up before their first post. */
export default function CompanySetup({ onCreated }: { onCreated: (company: { name: string }) => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name'));
    try {
      const response = await authenticatedFetch(`${API_URL}/users/company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          industry: form.get('industry'),
          location: form.get('location'),
          website: form.get('website') || undefined,
          description: form.get('description'),
        }),
      });
      if (!response.ok) throw new Error('company');
      onCreated({ name });
    } catch {
      setError(t('postJob.companySaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8 md:py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 dark:text-white">{t('postJob.companyTitle')}</h1>
        <p className="text-[15px] leading-relaxed text-ink-500 dark:text-slate-300">{t('postJob.companyText')}</p>
      </div>
      <section className="flex flex-col gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900">
        {FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1.5">
            <span className={labelText}>{t(`postJob.company.${field}`)}</span>
            <input name={field} required className={input} />
          </label>
        ))}
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>{t('postJob.company.website')}</span>
          <input name="website" type="url" inputMode="url" placeholder="https://" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>{t('postJob.company.description')}</span>
          <textarea name="description" required rows={4} className={`${input} resize-y py-3 leading-normal`} />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian">
          {t(saving ? 'postJob.saving' : 'postJob.companySave')}
        </button>
      </section>
    </form>
  );
}
