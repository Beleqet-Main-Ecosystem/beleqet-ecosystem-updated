'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { apiError, errorText } from '@/lib/api-error';
import { useTranslation } from '@/lib/i18n';
import { botRegistrationUrl, openInTelegram } from '@/lib/telegram-login';
import { GENDERS, type Gender } from '@/features/jobs/format';
import { JOB_TYPES } from '@/features/jobs/search-params';
import CompanySetup from '@/features/jobs/components/CompanySetup';
import {
  EMPTY_FIELDS,
  fieldsFromJob,
  jobProblem,
  jobRequestBody,
  LEVELS,
  MIN_DESCRIPTION,
  PAY_PERIODS,
  type JobFields,
  type SavedJob,
} from '@/features/jobs/post-job-fields';
import { API_URL } from './data';
import MainAction from './MainAction';
import { Band, card, chipOff, chipOn, CompanyMark, muted, outlineButton } from './ui';

type Category = { id: string; label: string };
type Quota = { plan: string; used: number; max: number | null; canFeature: boolean };

/** Each step and the fields it checks before moving on. */
const STEPS: { key: string; fields: (keyof JobFields)[] }[] = [
  { key: 'basics', fields: ['title', 'categoryId', 'location'] },
  { key: 'pay', fields: ['salaryMax'] },
  { key: 'details', fields: ['description'] },
  { key: 'review', fields: [] },
];

const input =
  'min-h-12 w-full min-w-0 rounded-xl border border-ink-300 bg-white px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-mini-tag dark:border-mini-dborder dark:bg-mini-dcard dark:text-white dark:focus:ring-mini-lime';
const label = 'text-sm font-bold text-ink-900 dark:text-white';

/**
 * Posting a job in the Mini App, one step at a time, with Telegram's bottom button for Next and Send.
 * Same rules and request as the website's form (features/jobs/post-job-fields). With editId it loads
 * one of the employer's own jobs and saves changes to it.
 */
export default function PostJobWizard({ categories, editId }: { categories: Category[]; editId?: string }) {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const editing = Boolean(editId);
  const canPost = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';

  const [company, setCompany] = useState<{ name: string; logoUrl?: string | null } | null | undefined>(undefined);
  const [companyFailed, setCompanyFailed] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  // undefined while loading, null when the job isn't one of the employer's.
  const [savedJob, setSavedJob] = useState<SavedJob | null | undefined>(undefined);
  const [jobFailed, setJobFailed] = useState(false);

  const [fields, setFields] = useState<JobFields>(EMPTY_FIELDS);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: string } | null>(null);

  const set = (patch: Partial<JobFields>) => setFields((current) => ({ ...current, ...patch }));

  const loadJob = useCallback(async () => {
    if (!editId) return;
    setJobFailed(false);
    try {
      // The employer's own list, so nobody can open someone else's job here.
      const response = await authenticatedFetch(`${API_URL}/jobs/my`);
      if (!response.ok) throw new Error('jobs');
      const job = ((await response.json()) as SavedJob[]).find((item) => item.id === editId) ?? null;
      if (job) setFields(fieldsFromJob(job));
      setSavedJob(job);
    } catch {
      setJobFailed(true);
    }
  }, [editId]);

  const load = useCallback(async () => {
    setCompanyFailed(false);
    void loadJob();
    try {
      const response = await authenticatedFetch(`${API_URL}/users/company`);
      if (!response.ok) throw new Error('company');
      const text = await response.text();
      setCompany(text ? JSON.parse(text) : null);
    } catch {
      setCompanyFailed(true);
    }
    authenticatedFetch(`${API_URL}/jobs/my/quota`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [loadJob]);

  useEffect(() => {
    if (ready && canPost) void load();
  }, [ready, canPost, load]);

  if (!ready) return <div className="min-h-[60vh]" aria-busy="true" />;

  if (!user || !canPost) {
    return (
      <Notice title={t(user ? 'postJob.roleTitle' : 'mini.post.registerTitle')} text={t(user ? 'postJob.roleText' : 'mini.post.registerText')}>
        {!user && (
          <button type="button" onClick={() => openInTelegram(botRegistrationUrl('/tg/post-job'))} className={outlineButton}>
            {t('mini.guest.button')}
          </button>
        )}
      </Notice>
    );
  }
  if (companyFailed || (editing && jobFailed)) {
    return (
      <Notice title={t(companyFailed ? 'postJob.companyFailed' : 'postJob.editLoadFailed')}>
        <button type="button" onClick={() => void load()} className={outlineButton}>{t('mini.retry')}</button>
      </Notice>
    );
  }
  if (company === undefined || (editing && savedJob === undefined)) return <div className="min-h-[60vh]" aria-busy="true" />;
  if (company === null) return <div className="px-1 pb-6"><CompanySetup onCreated={setCompany} /></div>;
  if (editing && savedJob === null) return <Notice title={t('postJob.editMissing')} text={t('postJob.editMissingText')} />;

  if (result) {
    const inReview = result.status === 'PENDING_REVIEW';
    const heading = inReview ? 'postJob.reviewTitle' : editing ? 'postJob.savedTitle' : 'postJob.liveTitle';
    const body = inReview ? (editing ? 'postJob.savedReviewText' : 'postJob.reviewText') : editing ? 'postJob.savedText' : 'postJob.liveText';
    return (
      <>
        <main className="flex flex-1 flex-col p-4">
          <section className={`${card} flex flex-col items-center gap-3 px-5 py-10 text-center`}>
            <CheckCircle2 className="h-10 w-10 text-mini-tag dark:text-mini-lime" aria-hidden="true" />
            <h1 className="font-display text-[22px] font-bold text-ink-900 dark:text-white">{t(heading)}</h1>
            <p className={`${muted} max-w-[420px] text-[15px] leading-relaxed`}>{t(body).replace('{title}', fields.title.trim())}</p>
          </section>
        </main>
        <MainAction text={t('mini.post.backToJobs')} href="/tg/employer" />
      </>
    );
  }

  const last = step === STEPS.length - 1;
  const canFeature = Boolean(quota?.canFeature || savedJob?.featured);
  // Editing doesn't use a post.
  const atLimit = !editing && quota?.max != null && quota.used >= quota.max;
  const min = Number(fields.salaryMin);
  const max = Number(fields.salaryMax);
  const pay = min && max ? `ETB ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}` : max || min ? `ETB ${(max || min).toLocaleString('en-US')}` : '';

  function next() {
    const issue = jobProblem(fields, STEPS[step].fields);
    setError(issue ? t(issue) : '');
    if (issue) return;
    setStep(step + 1);
    document.querySelector('.fixed.inset-0')?.scrollTo({ top: 0 });
  }

  async function send() {
    const issue = jobProblem(fields);
    setError(issue ? t(issue) : '');
    if (issue) {
      // Back to the step with the problem.
      setStep(Math.max(0, STEPS.findIndex((s) => jobProblem(fields, s.fields))));
      return;
    }
    setSending(true);
    try {
      const response = await authenticatedFetch(editing ? `${API_URL}/jobs/${editId}` : `${API_URL}/jobs`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobRequestBody(fields, { editing, canFeature })),
      });
      // A 403 is the plan's job limit or an unconfirmed email; errorText shows which.
      if (!response.ok) throw await apiError(response);
      const job = await response.json();
      setResult({ status: job.status ?? '' });
    } catch (problem) {
      setError(errorText(problem, t, editing ? 'postJob.saveFailed' : 'postJob.publishFailed'));
    } finally {
      setSending(false);
    }
  }

  const mainText = !last ? t('mini.post.next') : sending ? t('mini.post.sending') : t(editing ? 'mini.post.saveChanges' : 'mini.post.send');

  return (
    <>
      <Band>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-white/75">
            {t(editing ? 'postJob.editTitle' : 'postJob.title')} · {t('mini.post.stepOf').replace('{n}', String(step + 1)).replace('{total}', String(STEPS.length))}
          </span>
          <h1 className="font-display text-[24px] font-bold leading-tight tracking-[-0.02em]">{t(`mini.post.steps.${STEPS[step].key}`)}</h1>
          <ol aria-hidden="true" className="mt-1 grid grid-cols-4 gap-1">
            {STEPS.map((s, i) => (
              <li key={s.key} className={`h-[5px] rounded-full ${i <= step ? 'bg-mini-lime' : 'bg-white/20'}`} />
            ))}
          </ol>
        </div>
      </Band>

      <main className="flex flex-1 flex-col gap-3 p-4">
        {step === 0 && (
          <section className={`${card} flex flex-col gap-4 p-4`}>
            <Field label={t('postJob.jobTitle')}>
              <input type="text" value={fields.title} onChange={(e) => set({ title: e.target.value })} className={input} />
            </Field>
            <Field label={t('postJob.category')}>
              <select value={fields.categoryId} onChange={(e) => set({ categoryId: e.target.value })} className={input}>
                <option value="">{t('postJob.chooseCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </Field>
            <Field label={t('postJob.location')}>
              <input type="text" value={fields.location} onChange={(e) => set({ location: e.target.value })} className={input} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${label} pb-2`}>{t('postJob.jobType')}</legend>
              <div className="flex flex-wrap gap-2">
                {JOB_TYPES.map((code) => (
                  <button key={code} type="button" aria-pressed={fields.type === code} onClick={() => set({ type: code })} className={fields.type === code ? chipOn : chipOff}>
                    {t(`search.types.${code}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('postJob.openings')}>
                <input type="number" min={1} inputMode="numeric" value={fields.vacancies} onChange={(e) => set({ vacancies: e.target.value })} className={input} />
              </Field>
              <Field label={t('postJob.gender')}>
                <select value={fields.gender} onChange={(e) => set({ gender: e.target.value as Gender })} className={input}>
                  {GENDERS.map((value) => (
                    <option key={value} value={value}>{t(`postJob.genders.${value}`)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className={`${card} flex flex-col gap-4 p-4`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('freelance.post2.minimum')}>
                <input type="number" min={0} inputMode="numeric" value={fields.salaryMin} onChange={(e) => set({ salaryMin: e.target.value })} className={input} />
              </Field>
              <Field label={t('freelance.post2.maximum')}>
                <input type="number" min={0} inputMode="numeric" value={fields.salaryMax} onChange={(e) => set({ salaryMax: e.target.value })} className={input} />
              </Field>
            </div>
            <Field label={t('postJob.paid')}>
              <select value={fields.salaryType} onChange={(e) => set({ salaryType: e.target.value as JobFields['salaryType'] })} className={input}>
                {PAY_PERIODS.map((period) => (
                  <option key={period} value={period}>{t(`postJob.periods.${period}`)}</option>
                ))}
              </select>
            </Field>
            <p className={muted}>{t('postJob.salaryHint')}</p>
          </section>
        )}

        {step === 2 && (
          <section className={`${card} flex flex-col gap-4 p-4`}>
            <Field label={t('postJob.about')}>
              <textarea rows={7} value={fields.description} onChange={(e) => set({ description: e.target.value })} className={`${input} resize-y py-3 leading-normal`} />
              <span className={`${muted} self-end`}>
                {t('mini.post.count').replace('{count}', String(fields.description.trim().length)).replace('{min}', String(MIN_DESCRIPTION))}
              </span>
            </Field>
            <Field label={t('postJob.requirements')}>
              <textarea rows={5} value={fields.requirements} onChange={(e) => set({ requirements: e.target.value })} className={`${input} resize-y py-3 leading-normal`} />
            </Field>
            <Field label={t('postJob.experience')}>
              <select value={fields.experienceLevel} onChange={(e) => set({ experienceLevel: e.target.value })} className={input}>
                <option value="">{t('postJob.notSpecified')}</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{t(`postJob.levels.${level}`)}</option>
                ))}
                {/* Older and imported jobs may use a level outside the list; keep it selectable. */}
                {fields.experienceLevel && !(LEVELS as readonly string[]).includes(fields.experienceLevel) && (
                  <option value={fields.experienceLevel}>{fields.experienceLevel}</option>
                )}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('postJob.years')}>
                <input type="text" value={fields.years} onChange={(e) => set({ years: e.target.value })} className={input} />
              </Field>
              <Field label={t('postJob.qualification')}>
                <input type="text" value={fields.qualification} onChange={(e) => set({ qualification: e.target.value })} className={input} />
              </Field>
            </div>
          </section>
        )}

        {step === 3 && (
          <>
            <section aria-label={t('postJob.preview')} className={`${card} flex items-start gap-3 p-4`}>
              <CompanyMark name={company.name} logo={company.logoUrl} size={44} />
              <span className="flex min-w-0 flex-col gap-1">
                <b className="break-words text-base text-ink-900 dark:text-white">{fields.title.trim()}</b>
                <span className={muted}>{[company.name, fields.location.trim(), t(`search.types.${fields.type}`)].filter(Boolean).join(' · ')}</span>
                {pay && <b className="text-sm text-ink-900 dark:text-white">{pay} / {t(`postJob.units.${fields.salaryType}`)}</b>}
              </span>
            </section>
            <section className={`${card} flex flex-col gap-4 p-4`}>
              <Field label={t('postJob.deadline')}>
                <input type="date" value={fields.deadline} onChange={(e) => set({ deadline: e.target.value })} className={input} />
              </Field>
              <Check checked={fields.urgent} onChange={(urgent) => set({ urgent })} title={t('postJob.urgent')} text={t('postJob.urgentText')} />
              {canFeature && <Check checked={fields.featured} onChange={(featured) => set({ featured })} title={t('postJob.feature')} text={t('postJob.featureText')} />}
            </section>
            {quota && !editing && (
              <p className={`${muted} px-1`}>
                {quota.max == null
                  ? t('mini.employer.planUnlimited').replace('{plan}', quota.plan)
                  : t('mini.employer.planUsed').replace('{plan}', quota.plan).replace('{used}', String(quota.used)).replace('{max}', String(quota.max))}
              </p>
            )}
            {atLimit && <p className="px-1 text-sm font-semibold text-[#7A4B00] dark:text-[#F2C26B]">{t('postJob.limitReached')}</p>}
            {!editing && <p className={`${muted} px-1`}>{t('postJob.reviewNote')}</p>}
          </>
        )}

        {error && <p role="alert" className="px-1 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        {step > 0 && (
          <button type="button" onClick={() => { setError(''); setStep(step - 1); }} className={`${outlineButton} self-start`}>
            {t('mini.post.back')}
          </button>
        )}
      </main>

      <MainAction text={mainText} onClick={last ? send : next} disabled={sending || (last && atLimit)} />
    </>
  );
}

function Field({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, title, text }: { checked: boolean; onChange: (value: boolean) => void; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#052E1D]" />
      <span className="flex flex-col gap-0.5">
        <b className="text-[15px] text-ink-900 dark:text-white">{title}</b>
        <span className={muted}>{text}</span>
      </span>
    </label>
  );
}

function Notice({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <b className="text-[17px] text-ink-900 dark:text-white">{title}</b>
      {text && <p className={`${muted} max-w-[420px] text-[15px] leading-relaxed`}>{text}</p>}
      {children}
    </main>
  );
}
