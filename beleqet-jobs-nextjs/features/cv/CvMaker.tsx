'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Download, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import {
  buildProfilePayload,
  emptyCv,
  mergeExtractedProfile,
  type CvData,
  type Education,
  type Experience,
  type ExtractedProfile,
} from '@/lib/resume-brain/mapping';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const LOCAL_DRAFT = 'beleqet_cv_draft';
/** Resume Brain leaves what it read here for "Use these in CV Maker". */
export const CV_IMPORT_KEY = 'beleqet_cv_import';

const SECTIONS = ['contact', 'summary', 'experience', 'education', 'skills'] as const;
type SectionId = (typeof SECTIONS)[number];

const input = 'min-h-12 w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const textarea = `${input} resize-y py-3 leading-normal`;
const onDark = 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-bold text-white disabled:opacity-60';

export default function CvMaker() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const [cv, setCv] = useState<CvData>(emptyCv);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({ contact: true, summary: true, experience: true, education: false, skills: false });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'draft' | 'profile' | 'ai'>('');
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  // Load once; a later language switch must not replace what is being typed.
  const loaded = useRef(false);
  useEffect(() => {
    if (!ready || loaded.current) return;
    loaded.current = true;
    const imported = readImport();
    if (imported) {
      const { next, filled } = mergeExtractedProfile(emptyCv, imported);
      setCv(next);
      setAiFields(filled);
      setOpen({ contact: true, summary: true, experience: true, education: true, skills: true });
      setStatus(t('cv.imported'));
      return;
    }
    if (user) {
      authenticatedFetch(`${API_URL}/users/cv-draft`)
        .then(async (response) => {
          // An empty body means there is no draft yet.
          const draft = response.ok ? await response.json().catch(() => null) : null;
          if (draft?.data) setCv(draft.data);
        })
        .catch(() => undefined);
    } else {
      try {
        const draft = localStorage.getItem(LOCAL_DRAFT);
        if (draft) setCv(JSON.parse(draft));
      } catch {
        // Blocked storage or an unreadable draft: start empty.
      }
    }
  }, [ready, user, t]);

  function field<K extends keyof CvData>(key: K, value: CvData[K]) {
    setCv((old) => ({ ...old, [key]: value }));
    setStatus('');
    setAiFields((old) => {
      if (!old.has(key)) return old;
      const next = new Set(old);
      next.delete(key);
      return next;
    });
  }
  const updateExperience = (id: number, key: keyof Experience, value: string) =>
    field('experience', cv.experience.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  const updateEducation = (id: number, key: keyof Education, value: string) =>
    field('education', cv.education.map((item) => (item.id === id ? { ...item, [key]: value } : item)));

  async function saveDraft() {
    setBusy('draft');
    setError('');
    try {
      if (user) {
        const response = await authenticatedFetch(`${API_URL}/users/cv-draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: cv }),
        });
        if (!response.ok) throw new Error('draft');
      } else {
        localStorage.setItem(LOCAL_DRAFT, JSON.stringify(cv));
      }
      setStatus(t('cv.draftSaved'));
    } catch {
      setError(t('cv.draftFailed'));
    } finally {
      setBusy('');
    }
  }

  async function saveToProfile() {
    setError('');
    if (!user) {
      setError(t('cv.signInToSave'));
      return;
    }
    const payload = buildProfilePayload(cv);
    if (Object.keys(payload).length === 0) {
      setError(t('cv.nothingToSave'));
      return;
    }
    setBusy('profile');
    try {
      const response = await authenticatedFetch(`${API_URL}/users/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('profile');
      setStatus(t('cv.profileSaved'));
    } catch {
      setError(t('cv.profileFailed'));
    } finally {
      setBusy('');
    }
  }

  async function writeSummary() {
    setBusy('ai');
    setError('');
    try {
      const response = await fetch('/api/cv-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cv.fullName,
          title: cv.title,
          skills: cv.skills,
          experience: cv.experience.map(({ role, company, description }) => ({ role, company, description })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 400) throw new Error(t('cv.aiNeedsDetails'));
      if (!response.ok || !data.summary) throw new Error(t('cv.aiFailed'));
      field('summary', data.summary);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t('cv.aiFailed'));
    } finally {
      setBusy('');
    }
  }

  const filledJobs = cv.experience.filter((item) => item.role || item.company);
  const filledSchools = cv.education.filter((item) => item.school || item.qualification);
  const skills = split(cv.skills);
  const summaries: Record<SectionId, string> = {
    contact: cv.fullName || t('cv.notStarted'),
    summary: t(cv.summary.trim() ? 'cv.done' : 'cv.empty'),
    experience: t(filledJobs.length === 1 ? 'cv.oneJob' : 'cv.jobs').replace('{count}', String(filledJobs.length)),
    education: t(filledSchools.length === 1 ? 'cv.oneEntry' : 'cv.entries').replace('{count}', String(filledSchools.length)),
    skills: t(skills.length === 1 ? 'cv.oneSkill' : 'cv.skillCount').replace('{count}', String(skills.length)),
  };
  const mark = (key: string) => (aiFields.has(key) ? 'ring-2 ring-forest/40 dark:ring-limeAccent/40' : '');

  return (
    <div className="min-h-screen bg-canvas dark:bg-slate-950">
      <section className="bg-obsidian text-white print:hidden">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-4 pb-6 pt-5 md:px-[clamp(16px,4vw,40px)] md:pt-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">{t('cv.title')}</h1>
            <span role="status" className="text-[13px] text-white/70">{status || t('cv.saveHint')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/resume-brain" className={onDark}>{t('cv.fillFromOld')}</Link>
            <button type="button" onClick={saveDraft} disabled={busy !== ''} className={onDark}>{t(busy === 'draft' ? 'postJob.saving' : 'cv.saveDraft')}</button>
            <button type="button" onClick={saveToProfile} disabled={busy !== ''} className={onDark}>{t(busy === 'profile' ? 'postJob.saving' : 'cv.saveProfile')}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-limeAccent px-4 text-sm font-extrabold text-obsidian">
              <Download className="h-4 w-4" aria-hidden="true" /> {t('cv.download')}
            </button>
          </div>
          {error && <p role="alert" className="w-full text-sm font-semibold text-red-300">{error}</p>}
        </div>
      </section>

      <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-6 px-4 py-6 md:px-[clamp(16px,4vw,40px)] md:py-8 print:block print:max-w-none print:p-0">
        <form aria-label={t('cv.formLabel')} onSubmit={(event) => event.preventDefault()} className="flex min-w-0 flex-[999_1_520px] flex-col gap-3 print:hidden">
          {SECTIONS.map((id) => (
            <section key={id} className="rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
              <h2 className="m-0">
                <button
                  type="button"
                  aria-expanded={open[id]}
                  aria-controls={`cv-${id}`}
                  onClick={() => setOpen((old) => ({ ...old, [id]: !old[id] }))}
                  className="flex min-h-14 w-full items-center gap-3 px-5 text-left text-base font-bold text-ink-900 dark:text-white"
                >
                  <span className="flex-1">{t(`cv.sections.${id}`)}</span>
                  <span className="text-[13px] font-medium text-ink-500 dark:text-slate-400">{summaries[id]}</span>
                  <ChevronDown className={`h-[18px] w-[18px] text-ink-500 transition-transform dark:text-slate-400 ${open[id] ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
              </h2>
              {open[id] && (
                <div id={`cv-${id}`} className="flex flex-col gap-4 border-t border-[#F1F4F6] px-5 pb-5 pt-4 dark:border-slate-800">
                  {id === 'contact' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={t('cv.fullName')}><input type="text" autoComplete="name" value={cv.fullName} onChange={(e) => field('fullName', e.target.value)} className={`${input} ${mark('fullName')}`} /></Field>
                      <Field label={t('cv.jobTitle')}><input type="text" value={cv.title} onChange={(e) => field('title', e.target.value)} className={`${input} ${mark('title')}`} /></Field>
                      <Field label={t('cv.email')}><input type="email" autoComplete="email" value={cv.email} onChange={(e) => field('email', e.target.value)} className={`${input} ${mark('email')}`} /></Field>
                      <Field label={t('cv.phone')}><input type="tel" autoComplete="tel" value={cv.phone} onChange={(e) => field('phone', e.target.value)} className={`${input} ${mark('phone')}`} /></Field>
                      <Field label={t('cv.location')}><input type="text" value={cv.location} onChange={(e) => field('location', e.target.value)} className={`${input} ${mark('location')}`} /></Field>
                      <Field label={t('cv.website')}><input type="url" inputMode="url" placeholder="https://" value={cv.website} onChange={(e) => field('website', e.target.value)} className={input} /></Field>
                    </div>
                  )}

                  {id === 'summary' && (
                    <>
                      <Field label={t('cv.sections.summary')} hidden>
                        <textarea rows={5} value={cv.summary} placeholder={t('cv.summaryPlaceholder')} onChange={(e) => field('summary', e.target.value)} className={`${textarea} ${mark('summary')}`} />
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={writeSummary} disabled={busy !== ''} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-obsidian px-4 text-sm font-bold text-limeAccent disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian">
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          {t(busy === 'ai' ? 'cv.writing' : cv.summary.trim() ? 'cv.rewrite' : 'cv.writeForMe')}
                        </button>
                        <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('cv.aiNote')}</span>
                      </div>
                    </>
                  )}

                  {id === 'experience' && (
                    <>
                      {cv.experience.map((item, index) => (
                        <fieldset key={item.id} className="m-0 grid gap-3 rounded-lg border border-ink-200 p-4 md:grid-cols-2 dark:border-slate-800">
                          <legend className="px-1 text-sm font-bold text-ink-900 dark:text-white">{t('cv.jobNumber').replace('{n}', String(index + 1))}</legend>
                          <Field label={t('cv.role')}><input type="text" value={item.role} onChange={(e) => updateExperience(item.id, 'role', e.target.value)} className={input} /></Field>
                          <Field label={t('cv.company')}><input type="text" value={item.company} onChange={(e) => updateExperience(item.id, 'company', e.target.value)} className={input} /></Field>
                          <Field label={t('cv.start')}><input type="text" value={item.start} placeholder={t('cv.startPlaceholder')} onChange={(e) => updateExperience(item.id, 'start', e.target.value)} className={input} /></Field>
                          <Field label={t('cv.end')}><input type="text" value={item.end} placeholder={t('cv.endPlaceholder')} onChange={(e) => updateExperience(item.id, 'end', e.target.value)} className={input} /></Field>
                          <div className="md:col-span-2">
                            <Field label={t('cv.whatYouDid')}><textarea rows={3} value={item.description} onChange={(e) => updateExperience(item.id, 'description', e.target.value)} className={textarea} /></Field>
                          </div>
                          {cv.experience.length > 1 && (
                            <button type="button" onClick={() => field('experience', cv.experience.filter((x) => x.id !== item.id))} className="justify-self-start text-sm font-bold text-[#B42318] dark:text-red-300">{t('cv.removeJob')}</button>
                          )}
                        </fieldset>
                      ))}
                      <button type="button" onClick={() => field('experience', [...cv.experience, { id: Date.now(), role: '', company: '', start: '', end: '', description: '' }])} className="self-start text-sm font-bold text-forest dark:text-limeAccent">+ {t('cv.addJob')}</button>
                    </>
                  )}

                  {id === 'education' && (
                    <>
                      {cv.education.map((item) => (
                        <div key={item.id} className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                          <Field label={t('cv.school')}><input type="text" value={item.school} onChange={(e) => updateEducation(item.id, 'school', e.target.value)} className={input} /></Field>
                          <Field label={t('cv.qualification')}><input type="text" value={item.qualification} onChange={(e) => updateEducation(item.id, 'qualification', e.target.value)} className={input} /></Field>
                          <Field label={t('cv.year')}><input type="text" inputMode="numeric" value={item.year} onChange={(e) => updateEducation(item.id, 'year', e.target.value)} className={input} /></Field>
                          {cv.education.length > 1 && (
                            <button type="button" onClick={() => field('education', cv.education.filter((x) => x.id !== item.id))} className="justify-self-start text-sm font-bold text-[#B42318] md:col-span-3 dark:text-red-300">{t('cv.removeEntry')}</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => field('education', [...cv.education, { id: Date.now(), school: '', qualification: '', year: '' }])} className="self-start text-sm font-bold text-forest dark:text-limeAccent">+ {t('cv.addEntry')}</button>
                    </>
                  )}

                  {id === 'skills' && (
                    <>
                      <Field label={t('cv.skillsLabel')}><input type="text" value={cv.skills} onChange={(e) => field('skills', e.target.value)} className={`${input} ${mark('skills')}`} /></Field>
                      <Field label={t('cv.languages')}><input type="text" value={cv.languages} onChange={(e) => field('languages', e.target.value)} className={`${input} ${mark('languages')}`} /></Field>
                    </>
                  )}
                </div>
              )}
            </section>
          ))}
        </form>

        <aside aria-label={t('cv.preview')} className="flex min-w-0 flex-[1_1_440px] flex-col gap-2.5 md:sticky md:top-[88px] print:static">
          <span className="flex justify-between gap-3 text-sm print:hidden">
            <b className="text-ink-900 dark:text-white">{t('cv.preview')}</b>
            <span className="text-ink-500 dark:text-slate-400">{t('cv.a4')}</span>
          </span>
          <Preview cv={cv} skills={skills} jobs={filledJobs} schools={filledSchools} />
        </aside>
      </div>
    </div>
  );
}

function Preview({ cv, skills, jobs, schools }: { cv: CvData; skills: string[]; jobs: Experience[]; schools: Education[] }) {
  const { t } = useTranslation();
  const contact = [cv.email, cv.phone, cv.location, cv.website].filter(Boolean).join(' · ');
  return (
    <article className="flex min-h-[640px] flex-col gap-5 bg-white px-8 py-9 text-[#121922] shadow-[0_20px_60px_rgba(4,22,3,.12)] print:min-h-0 print:shadow-none">
      <header className="flex flex-col gap-1 border-b-2 border-[#041603] pb-4">
        <b className="text-[26px] font-extrabold tracking-[-0.02em]">{cv.fullName || t('cv.yourName')}</b>
        <span className="text-[15px] font-semibold text-[#00653B]">{cv.title || t('cv.jobTitle')}</span>
        {contact && <span className="text-xs text-[#4D5967]">{contact}</span>}
      </header>
      {cv.summary.trim() && <Block title={t('cv.sections.summary')}><p className="m-0 whitespace-pre-line text-[13px] leading-relaxed">{cv.summary}</p></Block>}
      <Block title={t('cv.experienceHeading')}>
        {jobs.length === 0 ? <Placeholder text={t('cv.experienceEmpty')} /> : jobs.map((item) => (
          <div key={item.id} className="flex flex-col gap-1">
            <span className="flex flex-wrap justify-between gap-2">
              <b className="text-[13px]">{[item.role, item.company].filter(Boolean).join(' · ')}</b>
              <span className="text-xs text-[#4D5967]">{[item.start, item.end].filter(Boolean).join(' – ')}</span>
            </span>
            {item.description && <span className="whitespace-pre-line text-[13px] leading-relaxed">{item.description}</span>}
          </div>
        ))}
      </Block>
      <Block title={t('cv.sections.education')}>
        {schools.length === 0 ? <Placeholder text={t('cv.educationEmpty')} /> : schools.map((item) => (
          <span key={item.id} className="text-[13px]"><b>{item.qualification}</b>{[item.school, item.year].filter(Boolean).map((part) => ` · ${part}`).join('')}</span>
        ))}
      </Block>
      {skills.length > 0 && <Block title={t('cv.skillsHeading')}><span className="text-[13px]">{skills.join(' · ')}</span></Block>}
      {cv.languages.trim() && <Block title={t('cv.languages')}><span className="text-[13px]">{split(cv.languages).join(' · ')}</span></Block>}
    </article>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <b className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#00653B]">{title}</b>
      {children}
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return <span className="text-[13px] italic text-[#6B7885] print:hidden">{text}</span>;
}

function Field({ label, hidden, children }: { label: string; hidden?: boolean; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={hidden ? 'sr-only' : 'text-sm font-bold text-ink-900 dark:text-white'}>{label}</span>
      {children}
    </label>
  );
}

function split(list: string) {
  return list.split(',').map((item) => item.trim()).filter(Boolean);
}

/** Take (once) what Resume Brain read, if the person came from "Use these in CV Maker". */
function readImport(): ExtractedProfile | null {
  try {
    const raw = sessionStorage.getItem(CV_IMPORT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(CV_IMPORT_KEY);
    return JSON.parse(raw) as ExtractedProfile;
  } catch {
    return null;
  }
}
