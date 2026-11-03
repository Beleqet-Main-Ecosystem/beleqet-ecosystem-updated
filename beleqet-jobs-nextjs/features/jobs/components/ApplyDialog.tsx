'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { safeHttpUrl } from '../format';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const COVER_MIN = 50;
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';

type Props = {
  jobId: string;
  jobTitle: string;
  company: string;
  onClose: () => void;
  onApplied: () => void;
};

/** Apply on Beleqet: profile CV or a new upload, optional cover letter. */
export default function ApplyDialog({ jobId, jobTitle, company, onClose, onApplied }: Props) {
  const { t } = useTranslation();
  const [profileCv, setProfileCv] = useState<string | null>(null);
  const [cvChoice, setCvChoice] = useState<'profile' | 'upload'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cover, setCover] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState<'form' | 'sending' | 'sent' | 'duplicate'>('form');
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const busy = status === 'sending';

  // Offer the CV already on the profile, so most people apply in one step.
  useEffect(() => {
    authenticatedFetch(`${API_URL}/users/profile`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (profile?.defaultResumeUrl) {
          setProfileCv(profile.defaultResumeUrl);
          setCvChoice('profile');
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [busy, onClose]);

  const coverTooShort = cover.trim().length > 0 && cover.trim().length < COVER_MIN;
  const needsFile = cvChoice === 'upload';
  const portfolioUrl = portfolio.trim() ? safeHttpUrl(portfolio) : null;
  const portfolioInvalid = portfolio.trim().length > 0 && !portfolioUrl;
  const canSend = !busy && !coverTooShort && !portfolioInvalid && (!needsFile || (file && consent));

  async function uploadCv(cv: File): Promise<string> {
    if (!CV_TYPES.includes(cv.type)) throw new Error(t('job.apply.errType'));
    if (cv.size > MAX_CV_BYTES) throw new Error(t('job.apply.errSize'));
    const form = new FormData();
    form.append('file', cv);
    form.append('hasConsentedToProcessing', 'true');
    const res = await authenticatedFetch(`${API_URL}/uploads/file`, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.publicUrl) throw new Error(data.message || t('job.apply.errUpload'));
    return data.publicUrl;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setStatus('sending');
    setError('');
    try {
      const resumeUrl = cvChoice === 'profile' ? profileCv ?? undefined : await uploadCv(file!);
      const res = await authenticatedFetch(`${API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          resumeUrl,
          coverLetter: cover.trim() || undefined,
          portfolioUrl: portfolioUrl ?? undefined,
          expectedSalary: salary ? Number(salary) : undefined,
        }),
      });
      if (res.status === 409) {
        setStatus('duplicate');
        onApplied();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(res.status === 404 ? t('job.apply.errClosed') : message || t('job.apply.errGeneric'));
      }
      setStatus('sent');
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('job.apply.errGeneric'));
      setStatus('form');
    }
  }

  const option = (on: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-[10px] p-3.5 ${on ? 'border-2 border-primary dark:border-limeAccent' : 'border border-ink-300 p-[15px] dark:border-slate-700'}`;
  const done = status === 'sent' || status === 'duplicate';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-primary/60 md:items-start md:p-4 md:pt-24">
      <div className="absolute inset-0" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-h"
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.35)] md:max-w-[560px] md:rounded-2xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4 md:px-[22px] dark:border-slate-800">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="apply-h" className="text-lg font-bold text-ink-900 dark:text-white">
              {done ? t(status === 'sent' ? 'job.apply.sentTitle' : 'job.apply.duplicateTitle') : t('job.apply.title')}
            </h2>
            <span className="truncate text-[13px] text-ink-600 dark:text-slate-400">{jobTitle} · {company}</span>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label={t('job.apply.close')} className={`grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-900 dark:text-white ${focusRing}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center md:px-[22px]">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-limeAccent text-obsidian">
              <Check className="h-[26px] w-[26px]" strokeWidth={3} aria-hidden="true" />
            </span>
            <p role="status" className="max-w-sm text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">
              {status === 'sent' ? t('job.apply.sentText').replace('{company}', company) : t('job.apply.duplicateText')}
            </p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
              <Link href="/applications" className={`inline-flex min-h-12 items-center rounded-md bg-primary px-[18px] text-[15px] font-bold text-white ${focusRing}`}>
                {t('job.apply.track')}
              </Link>
              <button type="button" onClick={onClose} className={`min-h-12 rounded-md border border-ink-300 bg-surface px-[18px] text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}>
                {t('job.apply.keepBrowsing')}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-[18px] overflow-y-auto px-5 pb-5 pt-5 md:px-[22px] md:pb-[22px]">
            <div role="group" aria-labelledby="apply-cv-h" className="flex flex-col gap-2.5">
              <h3 id="apply-cv-h" className="text-sm font-bold text-ink-900 dark:text-white">{t('job.apply.cv')}</h3>
              {profileCv && (
                <label className={option(cvChoice === 'profile')}>
                  <input type="radio" name="cv" checked={cvChoice === 'profile'} onChange={() => setCvChoice('profile')} className="mt-0.5 h-5 w-5 accent-primary" />
                  <span className="flex flex-col gap-0.5">
                    <b className="text-[15px] text-ink-900 dark:text-white">{t('job.apply.useProfileCv')}</b>
                    <span className="text-[13px] text-ink-600 dark:text-slate-400">{t('job.apply.useProfileCvHint')}</span>
                  </span>
                </label>
              )}
              <label className={option(cvChoice === 'upload')}>
                <input type="radio" name="cv" checked={cvChoice === 'upload'} onChange={() => setCvChoice('upload')} className="mt-0.5 h-5 w-5 accent-primary" />
                <span className="flex flex-col gap-0.5">
                  <b className="text-[15px] text-ink-900 dark:text-white">{t(profileCv ? 'job.apply.uploadOther' : 'job.apply.upload')}</b>
                  <span className="text-[13px] text-ink-600 dark:text-slate-400">{t('job.apply.uploadHint')}</span>
                </span>
              </label>
              {cvChoice === 'upload' && (
                <div className="flex flex-col gap-2.5 rounded-md border border-dashed border-ink-300 p-3.5 dark:border-slate-700">
                  <label className={`inline-flex min-h-11 cursor-pointer items-center self-start rounded-md border border-ink-300 px-3.5 text-sm font-bold text-ink-900 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700 dark:text-white`}>
                    {file ? file.name : t('job.apply.chooseFile')}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="sr-only"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] ?? null);
                        setConsent(false);
                      }}
                    />
                  </label>
                  <label className="flex items-start gap-2.5 text-[13px] leading-normal text-ink-700 dark:text-slate-300">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-primary" />
                    {t('job.apply.consent')}
                  </label>
                </div>
              )}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-900 dark:text-white">
                {t('job.apply.cover')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
              </span>
              <textarea
                rows={5}
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                maxLength={10000}
                placeholder={t('job.apply.coverPlaceholder')}
                aria-describedby="apply-cover-hint"
                className="resize-y rounded-md border border-ink-300 bg-surface p-3 text-[15px] leading-normal text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <span id="apply-cover-hint" className={`text-[13px] ${coverTooShort ? 'font-semibold text-[#B42318]' : 'text-ink-600 dark:text-slate-400'}`}>
                {coverTooShort ? t('job.apply.coverShort').replace('{n}', String(COVER_MIN - cover.trim().length)) : t('job.apply.coverHint')}
              </span>
            </label>

            <div className="grid gap-3.5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-ink-900 dark:text-white">
                  {t('job.apply.portfolio')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
                </span>
                <input
                  type="url"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="https://"
                  aria-invalid={portfolioInvalid || undefined}
                  className="min-h-12 min-w-0 rounded-md border border-ink-300 bg-surface px-3 text-[15px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                {portfolioInvalid && <span className="text-[13px] font-semibold text-[#B42318]">{t('job.apply.portfolioInvalid')}</span>}
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-ink-900 dark:text-white">
                  {t('job.apply.expectedSalary')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="min-h-12 min-w-0 rounded-md border border-ink-300 bg-surface px-3 text-[15px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-[#FDECEC] px-3.5 py-3 text-sm font-semibold text-[#9B2C2C]">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
              <button type="button" onClick={onClose} disabled={busy} className={`min-h-12 rounded-md border border-ink-300 bg-surface px-[18px] text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}>
                {t('job.apply.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSend}
                className={`min-h-12 rounded-md px-[22px] text-[15px] font-extrabold ${focusRing} ${canSend ? 'bg-primary text-limeAccent' : 'cursor-not-allowed bg-ink-200 text-ink-500'}`}
              >
                {busy ? t('job.apply.sending') : t('job.apply.send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
