'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Check, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import type { Job } from '@/lib/api';
import { errorText } from '@/lib/api-error';
import { apiGet, fetchProfile, type Profile } from '@/features/dashboard/api';
import { API_URL, fetchMiniAppJob } from '@/features/miniapp/data';
import MainAction from '@/features/miniapp/MainAction';
import { card, heading, muted, outlineButton } from '@/features/miniapp/ui';

const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_CV_BYTES = 10 * 1024 * 1024;
const NOTE_MIN = 50;

type Step = 'loading' | 'form' | 'sending' | 'sent' | 'duplicate';

export default function MiniAppApply() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>('loading');
  const [useProfileCv, setUseProfileCv] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    // Applying needs an account: registering happens in the bot, from the job page.
    if (!user) {
      router.replace(`/tg/jobs/${id}`);
      return;
    }
    Promise.all([
      fetchMiniAppJob(id),
      fetchProfile().catch(() => null),
      apiGet<Array<{ jobId: string }>>('/applications/my').catch(() => []),
    ]).then(([found, me, mine]) => {
      if (!found) {
        router.replace(`/tg/jobs/${id}`);
        return;
      }
      setJob(found);
      setProfile(me);
      setUseProfileCv(Boolean(me?.defaultResumeUrl));
      setStep((mine ?? []).some((row) => row.jobId === id) ? 'duplicate' : 'form');
    });
  }, [ready, user, id, router]);

  const noteShort = note.trim().length > 0 && note.trim().length < NOTE_MIN;
  const hasCv = useProfileCv ? Boolean(profile?.defaultResumeUrl) : Boolean(file);
  const canSend = step === 'form' && hasCv && consent && !noteShort;

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

  async function send() {
    if (!canSend) return;
    setStep('sending');
    setError('');
    try {
      const resumeUrl = useProfileCv ? profile?.defaultResumeUrl ?? undefined : await uploadCv(file!);
      const res = await authenticatedFetch(`${API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id, resumeUrl, coverLetter: note.trim() || undefined }),
      });
      if (res.status === 409) {
        setStep('duplicate');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message), { status: res.status });
      }
      setStep('sent');
    } catch (problem) {
      setError(problem instanceof Error && problem.message ? problem.message : errorText(problem, t, 'job.apply.errGeneric'));
      setStep('form');
    }
  }

  if (step === 'loading' || !job) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (step === 'sent' || step === 'duplicate') {
    return (
      <>
        <main className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-8">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <span aria-hidden="true" className="grid h-[68px] w-[68px] place-items-center rounded-full bg-mini-lime text-mini-onLime">
              <Check className="h-8 w-8" strokeWidth={3} />
            </span>
            <h1 role="status" className={heading}>{t(step === 'sent' ? 'mini.apply.sentTitle' : 'mini.apply.duplicateTitle')}</h1>
            <p className="text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">
              {(step === 'sent' ? t('mini.apply.sentText') : t('mini.apply.duplicateText')).replace('{title}', job.title).replace('{company}', job.company)}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-mini-lime/15 p-3.5 text-mini-tag dark:text-mini-lime">
            <Send className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold leading-snug">{t('mini.apply.updatesInBot')}</span>
          </div>
          <Link href="/tg" className={outlineButton}>{t('mini.apply.keepBrowsing')}</Link>
        </main>
        <MainAction text={t('mini.apply.track')} href="/tg/applications" />
      </>
    );
  }

  const contact = [
    `${profile?.firstName ?? user?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim(),
    profile?.phone,
    profile?.telegramUsername ? `@${profile.telegramUsername}` : null,
    profile?.city,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold uppercase tracking-wide text-mini-tag dark:text-mini-lime">{t('mini.apply.eyebrow')}</span>
          <h1 className={heading}>{job.title}</h1>
          <span className={muted}>{[job.company, job.location].filter(Boolean).join(' · ')}</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-[15px] font-extrabold">{t('mini.apply.cv')}</legend>
          {profile?.defaultResumeUrl && (
            <label className={`${card} flex items-start gap-3 p-3.5 ${useProfileCv ? '!border-2 !border-mini-ink dark:!border-mini-lime' : ''}`}>
              <input type="radio" name="cv" checked={useProfileCv} onChange={() => setUseProfileCv(true)} className="mt-0.5 h-5 w-5 accent-mini-ink" />
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px]">{t('mini.apply.profileCv')}</b>
                <span className={muted}>{t('mini.apply.profileCvHint')}</span>
              </span>
            </label>
          )}
          <label className={`${card} flex items-start gap-3 p-3.5 ${!useProfileCv ? '!border-2 !border-mini-ink dark:!border-mini-lime' : ''}`}>
            <input type="radio" name="cv" checked={!useProfileCv} onChange={() => { setUseProfileCv(false); fileRef.current?.click(); }} className="mt-0.5 h-5 w-5 accent-mini-ink" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-[15px]">{file ? file.name : t('mini.apply.upload')}</b>
              <span className={muted}>{t('mini.apply.uploadHint')}</span>
            </span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              if (chosen) {
                setFile(chosen);
                setUseProfileCv(false);
              }
            }}
          />
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-extrabold">
            {t('mini.apply.note')} <span className="font-medium text-mini-muted dark:text-slate-400">({t('mini.apply.optional')})</span>
          </span>
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('mini.apply.notePlaceholder')}
            className="resize-none rounded-xl border border-ink-300 bg-white p-3 text-base leading-normal dark:border-slate-700 dark:bg-slate-900"
          />
          {noteShort && <span className="text-[13px] text-[#9A3412] dark:text-[#F2C26B]">{t('job.apply.coverShort').replace('{n}', String(NOTE_MIN - note.trim().length))}</span>}
        </label>

        <section className={`${card} flex flex-col gap-2.5 p-3.5`}>
          <b className="text-sm">{t('mini.apply.employerSees')}</b>
          <span className="text-sm leading-relaxed text-ink-700 dark:text-slate-300">{contact}</span>
          <label className="flex items-start gap-2.5 text-sm leading-snug text-ink-700 dark:text-slate-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-mini-ink" />
            <span>{t('job.apply.consent')}</span>
          </label>
        </section>

        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      </form>
      <MainAction text={t(step === 'sending' ? 'mini.apply.sending' : 'mini.apply.send')} onClick={send} disabled={!canSend} />
    </>
  );
}
