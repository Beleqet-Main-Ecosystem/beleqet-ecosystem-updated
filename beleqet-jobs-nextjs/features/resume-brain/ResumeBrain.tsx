'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Upload, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { resumeToCvImport } from '@/lib/resume-brain/mapping';
import { autofillProfile, deleteResume, messageFromResumeBrainError, uploadResume } from '@/components/resume-brain/api';
import type { PersonalInfo, UploadResumeResponse } from '@/components/resume-brain/types';
import { CV_IMPORT_KEY } from '@/features/cv/CvMaker';

const STEPS = ['upload', 'reading', 'review', 'done'] as const;
type Step = (typeof STEPS)[number];
const ACCEPTED = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_MB = 10;

const card = 'flex flex-col gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';
const input = 'min-h-12 w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const missing = 'border-[#E0A458] bg-[#FFFBF3] dark:border-amber-500/60 dark:bg-amber-500/10';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-extrabold text-limeAccent disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500 dark:bg-limeAccent dark:text-obsidian dark:disabled:bg-slate-800 dark:disabled:text-slate-400';
const outline = 'inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-300 bg-surface px-4 text-[15px] font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

export default function ResumeBrain() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResumeResponse | null>(null);
  const [info, setInfo] = useState<PersonalInfo>({ fullName: '', email: '', phone: '', location: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bumped on Cancel so a reading that finishes later is ignored.
  const attempt = useRef(0);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent('/resume-brain')}`);
  }, [ready, user, router]);

  if (!ready || !user) return <div className="min-h-[60vh]" />;

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    setError('');
    if (!ACCEPTED.includes(candidate.type)) return setError(t('resumeBrain.wrongType'));
    if (candidate.size > MAX_MB * 1024 * 1024) return setError(t('resumeBrain.tooBig').replace('{mb}', String(MAX_MB)));
    setFile(candidate);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files?.[0]);
  }

  async function read() {
    if (!file || !consent) return;
    const mine = ++attempt.current;
    setError('');
    setProgress(0);
    setStep('reading');
    try {
      const response = await uploadResume(file, consent, setProgress);
      if (mine !== attempt.current) return;
      setResult(response);
      setInfo({
        fullName: response.parsedResume.personalInfo.fullName ?? '',
        email: response.parsedResume.personalInfo.email ?? '',
        phone: response.parsedResume.personalInfo.phone ?? '',
        location: response.parsedResume.personalInfo.location ?? '',
      });
      setSkills(response.parsedResume.skills.filter(Boolean));
      setStep('review');
    } catch (problem) {
      if (mine !== attempt.current) return;
      setError(messageFromResumeBrainError(problem, t('resumeBrain.readFailed')));
      setStep('upload');
    }
  }

  async function apply() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      await autofillProfile(user!.id, result.parsedResume.id, { personalInfo: info, skills });
      setStep('done');
    } catch (problem) {
      setError(messageFromResumeBrainError(problem, t('resumeBrain.applyFailed')));
    } finally {
      setBusy(false);
    }
  }

  function useInCvMaker() {
    if (!result) return;
    try {
      sessionStorage.setItem(CV_IMPORT_KEY, JSON.stringify(resumeToCvImport({ ...result.parsedResume, personalInfo: info, skills })));
    } catch {
      // Storage blocked: CV Maker opens with the saved draft instead.
    }
    router.push('/cv-maker');
  }

  async function removeFile() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      // Erasure is by upload; it removes the stored file and what was read from it.
      await deleteResume(result.upload.id);
      setDeleted(true);
    } catch (problem) {
      setError(messageFromResumeBrainError(problem, t('resumeBrain.deleteFailed')));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    attempt.current++;
    setStep('upload');
    setFile(null);
    setConsent(false);
    setResult(null);
    setError('');
    setDeleted(false);
  }

  const index = STEPS.indexOf(step);
  const parsed = result?.parsedResume;
  const fileLabel = file ? `${file.name.split('.').pop()?.toUpperCase()} · ${Math.max(1, Math.round(file.size / 1024))} KB` : '';

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-2.5 px-4 pb-8 pt-5 md:px-[clamp(16px,4vw,40px)] md:pt-8">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,36px)]">{t('resumeBrain.title')}</h1>
          <p className="max-w-[620px] text-base leading-relaxed text-white/75">{t('resumeBrain.subtitle')}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1000px] flex-col gap-5 px-4 pb-14 pt-7 md:px-[clamp(16px,4vw,40px)]">
        <ol aria-label={t('freelance.post2.progress')} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
          {STEPS.map((name, i) => (
            <li key={name} aria-current={i === index ? 'step' : undefined} className="flex flex-col gap-2">
              <span className={`h-1 rounded-full ${i <= index ? 'bg-forest dark:bg-limeAccent' : 'bg-ink-200 dark:bg-slate-800'}`} />
              <span className={`text-[13px] ${i === index ? 'font-bold' : 'font-medium'} ${i <= index ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-slate-400'}`}>
                {i + 1}. {t(`resumeBrain.steps.${name}`)}
              </span>
            </li>
          ))}
        </ol>

        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

        {step === 'upload' && (
          <section className={card}>
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-11 text-center ${file || dragging ? 'border-forest bg-[#F1F7EC] dark:border-limeAccent dark:bg-limeAccent/5' : 'border-ink-300 bg-[#FAFBF9] dark:border-slate-700 dark:bg-slate-950'}`}
            >
              <span className="grid h-14 w-14 place-items-center rounded-xl bg-obsidian text-limeAccent" aria-hidden="true"><Upload className="h-6 w-6" /></span>
              <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" tabIndex={-1} onChange={(event: ChangeEvent<HTMLInputElement>) => { pick(event.target.files?.[0]); event.target.value = ''; }} />
              {file ? (
                <>
                  <b className="break-all text-[17px] text-ink-900 dark:text-white">{file.name}</b>
                  <span className="text-sm text-ink-500 dark:text-slate-400">{fileLabel}</span>
                  <button type="button" onClick={() => inputRef.current?.click()} className="min-h-10 px-3 text-sm font-bold text-forest dark:text-limeAccent">{t('resumeBrain.another')}</button>
                </>
              ) : (
                <>
                  <b className="text-lg text-ink-900 dark:text-white">{t('resumeBrain.drag')}</b>
                  <span className="text-sm text-ink-500 dark:text-slate-400">{t('resumeBrain.types').replace('{mb}', String(MAX_MB))}</span>
                  <button type="button" onClick={() => inputRef.current?.click()} className={outline}>{t('resumeBrain.choose')}</button>
                </>
              )}
            </div>
            <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-700 dark:text-slate-300">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
              <span>{t('resumeBrain.consent')}</span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('resumeBrain.scanned')}</span>
              <button type="button" onClick={read} disabled={!file || !consent} className={solid}>{t('resumeBrain.read')}</button>
            </div>
          </section>
        )}

        {step === 'reading' && (
          <section role="status" className={`${card} items-center py-14 text-center`}>
            <b className="break-all text-xl text-ink-900 dark:text-white">{t('resumeBrain.reading').replace('{file}', file?.name ?? '')}</b>
            <span className="text-[15px] text-ink-500 dark:text-slate-400">{t(progress >= 100 ? 'resumeBrain.finding' : 'resumeBrain.uploading')}</span>
            <div role="progressbar" aria-label={t('resumeBrain.progress')} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full max-w-[420px] overflow-hidden rounded-full bg-[#EEF1EF] dark:bg-slate-800">
              <div className={`h-2 bg-forest dark:bg-limeAccent ${progress >= 100 ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(progress, 8)}%` }} />
            </div>
            <button type="button" onClick={restart} className={outline}>{t('postJob.cancel')}</button>
          </section>
        )}

        {step === 'review' && parsed && (
          <>
            <p className="text-[15px] text-ink-700 dark:text-slate-300">{t('resumeBrain.reviewIntro')}</p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
                <section className={card}>
                  <h2 className="text-[17px] font-bold text-ink-900 dark:text-white">{t('resumeBrain.contact')}</h2>
                  {(['fullName', 'email', 'phone', 'location'] as const).map((key) => (
                    <label key={key} className="flex flex-col gap-1.5">
                      <span className="text-sm font-bold text-ink-900 dark:text-white">{t(`resumeBrain.fields.${key}`)}</span>
                      <input
                        type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                        value={info[key] ?? ''}
                        placeholder={info[key] ? undefined : t('resumeBrain.notFound')}
                        onChange={(event) => setInfo({ ...info, [key]: event.target.value })}
                        className={`${input} ${info[key] ? '' : missing}`}
                      />
                    </label>
                  ))}
                </section>
                <section className={card}>
                  <h2 className="text-[17px] font-bold text-ink-900 dark:text-white">
                    {t('resumeBrain.skills')} <span className="text-sm font-medium text-ink-500 dark:text-slate-400">· {t('resumeBrain.found').replace('{count}', String(skills.length))}</span>
                  </h2>
                  {skills.length === 0 ? (
                    <span className="text-sm text-ink-500 dark:text-slate-400">{t('resumeBrain.noSkills')}</span>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                      {skills.map((skill) => (
                        <li key={skill} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#EEF5EF] pl-3 pr-1.5 text-sm font-semibold text-forest dark:bg-limeAccent/10 dark:text-limeAccent">
                          {skill}
                          <button type="button" aria-label={t('freelance.post2.removeSkill').replace('{skill}', skill)} onClick={() => setSkills(skills.filter((item) => item !== skill))} className="grid h-7 w-7 place-items-center rounded-full">
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
              <section className={`${card} min-w-0 flex-[1_1_360px]`}>
                <h2 className="text-[17px] font-bold text-ink-900 dark:text-white">{t('resumeBrain.experience')}</h2>
                {parsed.workExperience.length === 0 ? (
                  <span className="text-sm text-ink-500 dark:text-slate-400">{t('resumeBrain.noneFound')}</span>
                ) : parsed.workExperience.map((job, i) => (
                  <div key={i} className="flex flex-col gap-0.5 border-t border-[#F1F4F6] pt-2.5 dark:border-slate-800">
                    <b className="text-[15px] text-ink-900 dark:text-white">{job.title || job.company}</b>
                    <span className="text-[13px] text-ink-500 dark:text-slate-400">{[job.title ? job.company : null, [job.startDate, job.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
                <h2 className="mt-2 text-[17px] font-bold text-ink-900 dark:text-white">{t('resumeBrain.education')}</h2>
                {parsed.education.length === 0 ? (
                  <span className="text-sm text-ink-500 dark:text-slate-400">{t('resumeBrain.noneFound')}</span>
                ) : parsed.education.map((school, i) => (
                  <div key={i} className="flex flex-col gap-0.5 border-t border-[#F1F4F6] pt-2.5 dark:border-slate-800">
                    <b className="text-[15px] text-ink-900 dark:text-white">{[school.degree, school.fieldOfStudy].filter(Boolean).join(', ') || school.institution}</b>
                    <span className="text-[13px] text-ink-500 dark:text-slate-400">{[school.degree || school.fieldOfStudy ? school.institution : null, [school.startDate, school.endDate].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
                  </div>
                ))}
                <button type="button" onClick={useInCvMaker} className={`${outline} mt-1`}>{t('resumeBrain.useInCv')}</button>
              </section>
            </div>
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-surface px-5 py-4 shadow-[0_-8px_24px_rgba(4,22,3,0.06)] dark:border-slate-800 dark:bg-slate-900">
              <span className="text-sm text-ink-700 dark:text-slate-300">{t('resumeBrain.adds').replace('{count}', String(skills.length))}</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={restart} className={outline}>{t('resumeBrain.startOver')}</button>
                <button type="button" onClick={apply} disabled={busy} className={solid}>{t(busy ? 'resumeBrain.adding' : 'resumeBrain.addToProfile')}</button>
              </span>
            </div>
          </>
        )}

        {step === 'done' && (
          <section className={`${card} items-center py-14 text-center`}>
            <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-limeAccent text-obsidian" aria-hidden="true"><Check className="h-7 w-7" strokeWidth={3} /></span>
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">{t('resumeBrain.doneTitle')}</h2>
            <p className="text-[15px] text-ink-500 dark:text-slate-400">{t('resumeBrain.doneText').replace('{count}', String(skills.length))}</p>
            <span className="flex flex-wrap justify-center gap-2">
              <Link href="/dashboard?tab=profile" prefetch={false} className={solid}>{t('resumeBrain.viewProfile')}</Link>
              <Link href="/feed" prefetch={false} className={outline}>{t('resumeBrain.findJobs')}</Link>
              <button type="button" onClick={useInCvMaker} className={outline}>{t('resumeBrain.useInCv')}</button>
            </span>
            {deleted ? (
              <span role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{t('resumeBrain.deleted')}</span>
            ) : (
              <button type="button" onClick={removeFile} disabled={busy} className="min-h-10 px-3 text-sm font-semibold text-[#B42318] disabled:opacity-60 dark:text-red-300">{t('resumeBrain.deleteFile')}</button>
            )}
          </section>
        )}
      </div>
    </>
  );
}
