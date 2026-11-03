'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Paperclip, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import type { GigCategory } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget } from '@/features/jobs/format';
import { createGig, uploadAttachment } from '../actions';
import { categoryLabel } from '../search-params';

const STEPS = ['describe', 'budget', 'review'] as const;
const LEVELS = ['Entry', 'Intermediate', 'Expert'] as const;
const FILE_TYPES = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_DESCRIPTION = 30;

const input = 'min-h-12 min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelText = 'text-sm font-bold text-ink-900 dark:text-white';
const hint = 'text-[13px] text-ink-500 dark:text-slate-400';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-6 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';
const outline = 'inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-300 bg-surface px-6 text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const NEXT_STEPS = ['bids', 'accept', 'fund', 'approve'] as const;

export default function PostProject({ categories }: { categories: GigCategory[] }) {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [pricing, setPricing] = useState<'FIXED' | 'HOURLY'>('FIXED');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [days, setDays] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Intermediate');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState('');
  const [copied, setCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent('/freelance/post')}`);
  }, [ready, user, router]);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step, publishedId]);

  if (!ready || !user) return <div className="min-h-[60vh]" />;

  const min = Number(budgetMin);
  const max = Number(budgetMax);
  const budget = min >= 1 && max >= min ? `${formatBudget({ budgetMin: min, budgetMax: max, currency: 'ETB' })}${pricing === 'HOURLY' ? ` / ${t('freelance.hour')}` : ''}` : '';
  const pricingName = t(pricing === 'HOURLY' ? 'freelance.hourly' : 'freelance.fixed');
  const category = categories.find((item) => item.id === categoryId);

  function addSkill() {
    const skill = skillDraft.trim().replace(/,$/, '');
    if (skill && !skills.some((item) => item.toLowerCase() === skill.toLowerCase())) setSkills([...skills, skill]);
    setSkillDraft('');
  }

  function onSkillKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill();
    }
  }

  function addFiles(picked: FileList | null) {
    const list = Array.from(picked ?? []);
    if (list.some((file) => file.size > MAX_FILE_BYTES)) {
      setError(t('freelance.post2.fileTooBig'));
      return;
    }
    setError('');
    setFiles([...files, ...list]);
  }

  function stepError(): string {
    if (step === 0) {
      if (title.trim().length < 5) return t('freelance.post2.errTitle');
      if (!categoryId) return t('freelance.post2.errCategory');
      if (description.trim().length < MIN_DESCRIPTION) return t('freelance.post2.errDescription');
      if (skills.length === 0 && !skillDraft.trim()) return t('freelance.post2.errSkills');
    }
    if (step === 1) {
      if (!budget) return t('freelance.post2.errBudget');
      if (!(Number(days) >= 1)) return t('freelance.post2.errDays');
    }
    return '';
  }

  async function next() {
    if (skillDraft.trim()) addSkill();
    const problem = stepError();
    setError(problem);
    if (problem) return;
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setPublishing(true);
    try {
      const attachments = await Promise.all(files.map(uploadAttachment));
      const gig = await createGig({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        budgetMin: min,
        budgetMax: max,
        pricingType: pricing,
        deadlineDays: Math.round(Number(days)),
        skills,
        experienceLevel: level,
        locationPreference: location.trim() || undefined,
        attachments,
      });
      setPublishedId(gig.id);
    } catch {
      setError(t('freelance.post2.publishFailed'));
    } finally {
      setPublishing(false);
    }
  }

  async function share() {
    await navigator.clipboard?.writeText(`${window.location.origin}/freelance/${publishedId}`).catch(() => {});
    setCopied(true);
  }

  if (publishedId) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-[clamp(16px,4vw,40px)] md:py-12">
        <section className="flex flex-col items-center gap-3 rounded-xl border border-ink-200 bg-surface px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="h-10 w-10 text-forest dark:text-limeAccent" aria-hidden="true" />
          <h1 ref={heading} tabIndex={-1} className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 outline-none dark:text-white">{t('freelance.post2.liveTitle')}</h1>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-ink-500 dark:text-slate-300">{t('freelance.post2.liveText')}</p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <Link href={`/freelance/${publishedId}`} className={solid}>{t('freelance.post2.view')}</Link>
            <button type="button" onClick={share} className={outline}>{t(copied ? 'freelance.post2.copied' : 'freelance.post2.share')}</button>
          </div>
        </section>
      </div>
    );
  }

  const review: [string, string][] = [
    [t('freelance.post2.titleLabel'), title.trim()],
    [t('freelance.post2.category'), category ? categoryLabel(category, t) : ''],
    [t('freelance.post2.skills'), skills.join(', ')],
    [t('freelance.gig.budget'), `${budget} · ${pricingName}`],
    [t('freelance.post2.neededWithin'), t('freelance.gig.days').replace('{days}', String(days))],
    [t('freelance.gig.experience'), t(`freelance.post2.levels.${level}`)],
  ];
  if (location.trim()) review.push([t('freelance.post2.location'), location.trim()]);
  if (files.length) review.push([t('freelance.gig.attachments'), files.map((file) => file.name).join(', ')]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-6 px-4 py-6 md:px-[clamp(16px,4vw,40px)] md:py-10">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
        <ol aria-label={t('freelance.post2.progress')} className="grid grid-cols-3 gap-2.5">
          {STEPS.map((name, index) => (
            <li key={name} aria-current={index === step ? 'step' : undefined} className="flex flex-col gap-2">
              <span className={`h-1 rounded-full ${index <= step ? 'bg-obsidian dark:bg-limeAccent' : 'bg-ink-200 dark:bg-slate-800'}`} />
              <span className={`text-[13px] font-bold ${index <= step ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-slate-400'}`}>
                {index + 1}. {t(`freelance.post2.steps.${name}`)}
              </span>
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-5 rounded-xl border border-ink-200 bg-surface p-5 md:p-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-1.5">
            <h1 ref={heading} tabIndex={-1} className="text-[26px] font-extrabold tracking-[-0.03em] text-ink-900 outline-none dark:text-white">
              {t(`freelance.post2.heading.${STEPS[step]}`)}
            </h1>
            {step < 2 && <p className="text-[15px] text-ink-500 dark:text-slate-300">{t(`freelance.post2.sub.${STEPS[step]}`)}</p>}
          </div>

          {step === 0 && (
            <>
              <Field label={t('freelance.post2.titleLabel')} help={t('freelance.post2.titleHint')}>
                <input type="text" value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} className={input} />
              </Field>
              <Field label={t('freelance.post2.category')}>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={input}>
                  <option value="">{t('freelance.post2.chooseCategory')}</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>{categoryLabel(item, t)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('freelance.post2.description')} help={t('freelance.post2.descriptionHint')}>
                <textarea rows={7} value={description} onChange={(event) => setDescription(event.target.value)} className={`${input} resize-y py-3 leading-normal`} />
              </Field>
              <div className="flex flex-col gap-2">
                <span className={labelText}>{t('freelance.post2.skills')}</span>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-300 p-2 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700">
                  {skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F6] py-1 pl-3 pr-1 text-sm font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                      {skill}
                      <button
                        type="button"
                        aria-label={t('freelance.post2.removeSkill').replace('{skill}', skill)}
                        onClick={() => setSkills(skills.filter((item) => item !== skill))}
                        className="grid h-7 w-7 place-items-center rounded-full"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    aria-label={t('freelance.post2.addSkill')}
                    placeholder={t('freelance.post2.addSkill')}
                    value={skillDraft}
                    onChange={(event) => setSkillDraft(event.target.value)}
                    onKeyDown={onSkillKey}
                    onBlur={addSkill}
                    className="min-h-9 min-w-[140px] flex-1 bg-transparent px-1.5 text-base text-ink-900 outline-none dark:text-white"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className={labelText}>
                  {t('freelance.gig.attachments')} <span className="font-medium text-ink-500 dark:text-slate-400">({t('freelance.post2.optional')})</span>
                </span>
                <label className="relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-ink-300 p-5 text-center focus-within:ring-2 focus-within:ring-forest dark:border-slate-700">
                  <b className="text-[15px] text-ink-900 dark:text-white">{t('freelance.post2.browse')}</b>
                  <span className={hint}>{t('freelance.post2.fileHint')}</span>
                  <input type="file" multiple accept={FILE_TYPES} onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} className="absolute h-px w-px opacity-0" />
                </label>
                {files.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-ink-700 dark:text-slate-300">
                        <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button type="button" aria-label={t('freelance.post2.removeFile').replace('{file}', file.name)} onClick={() => setFiles(files.filter((_, at) => at !== index))} className="grid h-9 w-9 shrink-0 place-items-center">
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <fieldset className="flex flex-col gap-2.5">
                <legend className={`${labelText} pb-2`}>{t('freelance.post2.howPay')}</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
                  {(['FIXED', 'HOURLY'] as const).map((option) => (
                    <label key={option} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3.5 ${pricing === option ? 'border-2 border-obsidian dark:border-limeAccent' : 'border-ink-300 dark:border-slate-700'}`}>
                      <input type="radio" name="pricing" checked={pricing === option} onChange={() => setPricing(option)} className="mt-0.5 h-5 w-5 accent-primary" />
                      <span className="flex flex-col gap-0.5">
                        <b className="text-[15px] text-ink-900 dark:text-white">{t(option === 'FIXED' ? 'freelance.fixed' : 'freelance.hourly')}</b>
                        <span className={hint}>{t(`freelance.post2.${option === 'FIXED' ? 'fixedHint' : 'hourlyHint'}`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('freelance.post2.minimum')}>
                  <input type="number" inputMode="numeric" min={1} value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} className={input} />
                </Field>
                <Field label={t('freelance.post2.maximum')}>
                  <input type="number" inputMode="numeric" min={1} value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} className={input} />
                </Field>
              </div>
              <Field label={t('freelance.post2.neededDays')}>
                <input type="number" inputMode="numeric" min={1} value={days} onChange={(event) => setDays(event.target.value)} className={input} />
              </Field>
              <fieldset>
                <legend className={`${labelText} pb-2`}>{t('freelance.gig.experience')}</legend>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={level === option}
                      onClick={() => setLevel(option)}
                      className={`min-h-11 rounded-full border px-4 text-sm ${level === option ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                    >
                      {t(`freelance.post2.levels.${option}`)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label={`${t('freelance.post2.location')} (${t('freelance.post2.optional')})`}>
                <input type="text" value={location} onChange={(event) => setLocation(event.target.value)} className={input} />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <dl>
                {review.map(([key, value]) => (
                  <div key={key} className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#F1F4F6] py-3 dark:border-slate-800">
                    <dt className="flex-[0_0_180px] text-sm text-ink-500 dark:text-slate-400">{key}</dt>
                    <dd className="min-w-0 flex-[1_1_260px] break-words text-[15px] font-semibold text-ink-900 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-lg bg-[#EEF5EF] p-3.5 text-sm leading-relaxed text-ink-900 dark:bg-forest/30 dark:text-white">{t('freelance.post2.freeNote')}</div>
            </>
          )}

          {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        </section>

        <div className={`flex gap-2.5 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
          {step > 0 && (
            <button type="button" onClick={() => { setError(''); setStep(step - 1); }} className={outline}>{t('freelance.post2.back')}</button>
          )}
          <button type="button" disabled={publishing} onClick={next} className={solid}>
            {t(publishing ? 'freelance.post2.publishing' : step === 2 ? 'freelance.post2.publish' : 'freelance.post2.continue')}
          </button>
        </div>
      </div>

      <aside className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-4 md:max-w-[400px]">
        <section aria-label={t('freelance.post2.preview')} className="flex flex-col gap-2.5 rounded-xl border border-ink-200 bg-surface p-5 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink-500 dark:text-slate-400">{t('freelance.post2.preview')}</span>
          <b className="break-words text-base leading-[1.35] text-ink-900 dark:text-white">{title.trim() || t('freelance.post2.previewTitle')}</b>
          {skills.length > 0 && (
            <span className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span key={skill} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-700 dark:border-slate-700 dark:text-slate-200">{skill}</span>
              ))}
            </span>
          )}
          <span className="flex flex-wrap justify-between gap-2 border-t border-[#F1F4F6] pt-2.5 text-sm dark:border-slate-800">
            <b className="text-ink-900 dark:text-white">{budget || t('freelance.post2.previewBudget')}</b>
            <span className="text-ink-500 dark:text-slate-400">{pricingName}</span>
          </span>
        </section>
        <section aria-labelledby="next-h" className="flex flex-col gap-3 rounded-xl bg-obsidian p-5 text-white">
          <h2 id="next-h" className="text-[15px] font-bold text-limeAccent">{t('freelance.post2.nextTitle')}</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-normal text-white/80">
            {NEXT_STEPS.map((item) => (
              <li key={item}>{t(`freelance.post2.next.${item}`)}</li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={labelText}>{label}</span>
      {children}
      {help && <span className={hint}>{help}</span>}
    </label>
  );
}
