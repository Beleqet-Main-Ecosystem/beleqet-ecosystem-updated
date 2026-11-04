'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, MapPin } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { daysUntil, safeHttpUrl } from '../format';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const COVER_MIN = 50;
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';
// 16px text: smaller inputs make phones zoom in when they get focus.
const field = 'min-h-[52px] w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelText = 'text-[15px] font-bold text-ink-900 dark:text-white';
const hint = 'text-sm text-ink-600 dark:text-slate-400';

export type ApplyJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  closesAt?: string | null;
};

/**
 * Apply on Beleqet, as its own page: the profile CV or a new upload, an optional cover letter,
 * portfolio and expected salary. Signed-out visitors are sent to sign in and brought back here.
 */
export default function ApplyForm({ job }: { job: ApplyJob }) {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [profileCv, setProfileCv] = useState<string | null>(null);
  const [cvChoice, setCvChoice] = useState<'profile' | 'upload'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cover, setCover] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState<'checking' | 'form' | 'sending' | 'sent' | 'duplicate'>('checking');
  const [error, setError] = useState('');
  const busy = status === 'sending';
  const jobHref = `/jobs/${job.id}`;
  const days = daysUntil(job.closesAt);
  const closed = days !== null && days < 0;

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`${jobHref}/apply`)}`);
      return;
    }
    // Offer the CV already on the profile, and catch an earlier application before any typing.
    Promise.all([
      authenticatedFetch(`${API_URL}/users/profile`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
      authenticatedFetch(`${API_URL}/applications/my`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
    ]).then(([profile, apps]: [{ defaultResumeUrl?: string } | null, Array<{ jobId?: string; job?: { id?: string } }>]) => {
      if (profile?.defaultResumeUrl) {
        setProfileCv(profile.defaultResumeUrl);
        setCvChoice('profile');
      }
      const already = Array.isArray(apps) && apps.some((a) => (a.jobId ?? a.job?.id) === job.id);
      setStatus(already ? 'duplicate' : 'form');
    });
  }, [ready, user, router, job.id, jobHref]);

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
          jobId: job.id,
          resumeUrl,
          coverLetter: cover.trim() || undefined,
          portfolioUrl: portfolioUrl ?? undefined,
          expectedSalary: salary ? Number(salary) : undefined,
        }),
      });
      if (res.status === 409) {
        setStatus('duplicate');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(res.status === 404 ? t('job.apply.errClosed') : message || t('job.apply.errGeneric'));
      }
      setStatus('sent');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('job.apply.errGeneric'));
      setStatus('form');
    }
  }

  const option = (on: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-xl p-4 ${on ? 'border-2 border-primary dark:border-limeAccent' : 'border border-ink-300 p-[17px] dark:border-slate-700'}`;
  const done = status === 'sent' || status === 'duplicate';

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-4 pb-16 pt-5 md:pt-8">
      <Link href={jobHref} className={`inline-flex items-center gap-1.5 self-start rounded text-sm font-bold text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('job.apply.backToJob')}
      </Link>

      <header className="flex flex-col gap-1.5 rounded-xl border border-ink-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink-900 md:text-[30px] dark:text-white">
          {done ? t(status === 'sent' ? 'job.apply.sentTitle' : 'job.apply.duplicateTitle') : t('job.apply.title')}
        </h1>
        <p className="text-base font-semibold text-ink-800 dark:text-slate-200">{job.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600 dark:text-slate-400">
          <span>{job.company}</span>
          {job.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {job.location}
            </span>
          )}
        </p>
      </header>

      {status === 'checking' && <div className="min-h-[40vh]" aria-busy="true" />}

      {done && (
        <section className="flex flex-col items-center gap-4 rounded-xl border border-ink-200 bg-surface px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-limeAccent text-obsidian">
            <Check className="h-[26px] w-[26px]" strokeWidth={3} aria-hidden="true" />
          </span>
          <p role="status" className="max-w-md text-base leading-relaxed text-ink-700 dark:text-slate-300">
            {status === 'sent' ? t('job.apply.sentText').replace('{company}', job.company) : t('job.apply.duplicateText')}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="/applications" className={`inline-flex min-h-12 items-center rounded-lg bg-primary px-5 text-base font-bold text-white ${focusRing}`}>
              {t('job.apply.track')}
            </Link>
            <Link href="/jobs" className={`inline-flex min-h-12 items-center rounded-lg border border-ink-300 bg-surface px-5 text-base font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}>
              {t('job.apply.keepBrowsing')}
            </Link>
          </div>
        </section>
      )}

      {(status === 'form' || status === 'sending') && closed && (
        <p role="alert" className="rounded-xl bg-[#FDECEC] px-4 py-3.5 text-base font-semibold text-[#9B2C2C]">{t('job.apply.errClosed')}</p>
      )}

      {(status === 'form' || status === 'sending') && !closed && (
        <form onSubmit={submit} className="flex flex-col gap-6 rounded-xl border border-ink-200 bg-surface p-5 md:p-7 dark:border-slate-800 dark:bg-slate-900">
          <div role="group" aria-labelledby="apply-cv-h" className="flex flex-col gap-3">
            <h2 id="apply-cv-h" className={labelText}>{t('job.apply.cv')}</h2>
            {profileCv && (
              <label className={option(cvChoice === 'profile')}>
                <input type="radio" name="cv" checked={cvChoice === 'profile'} onChange={() => setCvChoice('profile')} className="mt-0.5 h-5 w-5 accent-primary" />
                <span className="flex flex-col gap-0.5">
                  <b className="text-base text-ink-900 dark:text-white">{t('job.apply.useProfileCv')}</b>
                  <span className={hint}>{t('job.apply.useProfileCvHint')}</span>
                </span>
              </label>
            )}
            <label className={option(cvChoice === 'upload')}>
              <input type="radio" name="cv" checked={cvChoice === 'upload'} onChange={() => setCvChoice('upload')} className="mt-0.5 h-5 w-5 accent-primary" />
              <span className="flex flex-col gap-0.5">
                <b className="text-base text-ink-900 dark:text-white">{t(profileCv ? 'job.apply.uploadOther' : 'job.apply.upload')}</b>
                <span className={hint}>{t('job.apply.uploadHint')}</span>
              </span>
            </label>
            {cvChoice === 'upload' && (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-ink-300 p-4 dark:border-slate-700">
                <label className="inline-flex min-h-12 max-w-full cursor-pointer items-center self-start rounded-lg border border-ink-300 px-4 text-base font-bold text-ink-900 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700 dark:text-white">
                  <span className="truncate">{file ? file.name : t('job.apply.chooseFile')}</span>
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
                <label className="flex items-start gap-3 text-sm leading-normal text-ink-700 dark:text-slate-300">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
                  {t('job.apply.consent')}
                </label>
              </div>
            )}
          </div>

          <label className="flex flex-col gap-2">
            <span className={labelText}>
              {t('job.apply.cover')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
            </span>
            <textarea
              rows={10}
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              maxLength={10000}
              placeholder={t('job.apply.coverPlaceholder')}
              aria-describedby="apply-cover-hint"
              className={`${field} min-h-[240px] resize-y py-3 leading-relaxed`}
            />
            <span id="apply-cover-hint" className={coverTooShort ? 'text-sm font-semibold text-[#B42318]' : hint}>
              {coverTooShort ? t('job.apply.coverShort').replace('{n}', String(COVER_MIN - cover.trim().length)) : t('job.apply.coverHint')}
            </span>
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className={labelText}>
                {t('job.apply.portfolio')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
              </span>
              <input
                type="url"
                value={portfolio}
                onChange={(e) => setPortfolio(e.target.value)}
                placeholder="https://"
                aria-invalid={portfolioInvalid || undefined}
                className={field}
              />
              {portfolioInvalid && <span className="text-sm font-semibold text-[#B42318]">{t('job.apply.portfolioInvalid')}</span>}
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelText}>
                {t('job.apply.expectedSalary')} <span className="font-medium text-ink-600 dark:text-slate-400">({t('job.apply.optional')})</span>
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={salary}
                onChange={(e) => setSalary(e.target.value.replace(/\D/g, '').slice(0, 9))}
                className={field}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-[#FDECEC] px-4 py-3 text-base font-semibold text-[#9B2C2C]">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Link href={jobHref} className={`inline-flex min-h-[52px] items-center justify-center rounded-lg border border-ink-300 bg-surface px-5 text-base font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}>
              {t('job.apply.cancel')}
            </Link>
            <button
              type="submit"
              disabled={!canSend}
              className={`min-h-[52px] rounded-lg px-6 text-base font-extrabold ${focusRing} ${canSend ? 'bg-primary text-limeAccent' : 'cursor-not-allowed bg-ink-200 text-ink-500'}`}
            >
              {busy ? t('job.apply.sending') : t('job.apply.send')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
