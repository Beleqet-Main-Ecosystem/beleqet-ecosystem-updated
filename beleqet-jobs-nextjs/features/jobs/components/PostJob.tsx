'use client';

import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { initials } from '../format';
import { JOB_TYPES, type JobTypeCode } from '../search-params';
import CompanySetup from './CompanySetup';
import { apiError, errorText } from '@/lib/api-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const PAY_PERIODS = ['monthly', 'daily', 'hourly'] as const;
const LEVELS = ['Entry level', 'Junior', 'Mid-level', 'Senior'] as const;
const MIN_DESCRIPTION = 50;

const input = 'min-h-12 w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3.5 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const labelText = 'text-sm font-bold text-ink-900 dark:text-white';
const hint = 'text-[13px] text-ink-500 dark:text-slate-400';
const card = 'flex flex-col gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';
const solid = 'inline-flex min-h-12 items-center justify-center rounded-lg bg-obsidian px-5 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian';
const outline = 'inline-flex min-h-12 items-center justify-center rounded-lg border border-ink-300 px-5 text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:text-white';

type Category = { id: string; label: string };
type Plan = { name: string; maxPosts: number | null; canFeature: boolean };
type SavedJob = {
  id: string;
  title: string;
  categoryId: string;
  location: string;
  vacancies: number | null;
  type: JobTypeCode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string | null;
  description: string;
  requirements: string | null;
  experienceLevel: string | null;
  yearsOfExperience: string | null;
  qualification: string | null;
  tags: string[];
  applyType: string | null;
  applyUrl: string | null;
  applyEmail: string | null;
  deadline: string | null;
  featured: boolean;
  urgent: boolean;
};

/** With editId the form loads one of the employer's own jobs and saves changes to it. */
export default function PostJob({ categories, editId }: { categories: Category[]; editId?: string }) {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const editing = Boolean(editId);
  const [company, setCompany] = useState<{ name: string } | null | undefined>(undefined);
  const [companyFailed, setCompanyFailed] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  // undefined while loading, null when the job isn't one of the employer's.
  const [saved, setSaved] = useState<SavedJob | null | undefined>(undefined);
  const [jobFailed, setJobFailed] = useState(false);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [vacancies, setVacancies] = useState('1');
  const [type, setType] = useState<JobTypeCode>('FULL_TIME');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryType, setSalaryType] = useState<(typeof PAY_PERIODS)[number]>('monthly');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [years, setYears] = useState('');
  const [qualification, setQualification] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [deadline, setDeadline] = useState('');
  const [featured, setFeatured] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState('');

  const canPost = user?.role === 'EMPLOYER' || user?.role === 'ADMIN';

  const fill = useCallback((job: SavedJob) => {
    setTitle(job.title);
    setCategoryId(job.categoryId);
    setLocation(job.location);
    setVacancies(String(job.vacancies ?? 1));
    setType(job.type);
    setSalaryMin(job.salaryMin ? String(job.salaryMin) : '');
    setSalaryMax(job.salaryMax ? String(job.salaryMax) : '');
    const period = PAY_PERIODS.find((item) => item === job.salaryType?.toLowerCase());
    setSalaryType(period ?? 'monthly');
    setDescription(job.description);
    setRequirements(job.requirements ?? '');
    setExperienceLevel(job.experienceLevel ?? '');
    setYears(job.yearsOfExperience ?? '');
    setQualification(job.qualification ?? '');
    setTags(job.tags ?? []);
    setDeadline(job.deadline ? job.deadline.slice(0, 10) : '');
    setFeatured(job.featured);
    setUrgent(job.urgent);
  }, []);

  const loadJob = useCallback(async () => {
    if (!editId) return;
    setJobFailed(false);
    try {
      // The employer's own list, so nobody can open someone else's job in the form.
      const response = await authenticatedFetch(`${API_URL}/jobs/my`);
      if (!response.ok) throw new Error('jobs');
      const jobs: SavedJob[] = await response.json();
      const job = jobs.find((item) => item.id === editId) ?? null;
      if (job) fill(job);
      setSaved(job);
    } catch {
      setJobFailed(true);
    }
  }, [editId, fill]);

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
    // Plan usage is a helpful extra: the form still works if it fails.
    authenticatedFetch(`${API_URL}/jobs/my/quota`)
      .then((response) => (response.ok ? response.json() : null))
      .then((quota: { plan: string; used: number; max: number | null; canFeature: boolean } | null) => {
        setPlan(quota ? { name: quota.plan, maxPosts: quota.max, canFeature: quota.canFeature } : null);
        setUsed(quota ? quota.used : null);
      })
      .catch(() => setPlan(null));
  }, [loadJob]);

  useEffect(() => {
    if (ready && canPost) void load();
  }, [ready, canPost, load]);

  if (!ready) return <div className="min-h-[60vh]" />;

  if (!user || !canPost) {
    const signedOut = !user;
    return (
      <Gate
        title={t(signedOut ? 'postJob.gateTitle' : 'postJob.roleTitle')}
        text={t(signedOut ? 'postJob.gateText' : 'postJob.roleText')}
        action={t(signedOut ? 'postJob.signIn' : 'postJob.createEmployer')}
        href={signedOut ? `/login?next=${encodeURIComponent(editId ? `/post-job?edit=${editId}` : '/post-job')}` : '/register?role=employer'}
      />
    );
  }

  if (companyFailed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-3 px-4 text-center">
        <p role="alert" className="text-[15px] font-semibold text-ink-900 dark:text-white">{t('postJob.companyFailed')}</p>
        <button type="button" onClick={load} className={solid}>{t('freelance.retry')}</button>
      </div>
    );
  }
  if (company === undefined) return <div className="min-h-[60vh]" />;
  if (company === null) return <CompanySetup onCreated={setCompany} />;

  if (editing && jobFailed) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-3 px-4 text-center">
        <p role="alert" className="text-[15px] font-semibold text-ink-900 dark:text-white">{t('postJob.editLoadFailed')}</p>
        <button type="button" onClick={loadJob} className={solid}>{t('freelance.retry')}</button>
      </div>
    );
  }
  if (editing && saved === undefined) return <div className="min-h-[60vh]" />;
  if (editing && saved === null) {
    return <Gate title={t('postJob.editMissing')} text={t('postJob.editMissingText')} action={t('postJob.dashboard')} href="/employer?tab=jobs" />;
  }

  if (publishedId) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-8 md:py-14">
        <section className="flex flex-col items-center gap-3 rounded-xl border border-ink-200 bg-surface px-5 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="h-10 w-10 text-forest dark:text-limeAccent" aria-hidden="true" />
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 dark:text-white">{t(editing ? 'postJob.savedTitle' : 'postJob.liveTitle')}</h1>
          <p className="max-w-[460px] text-[15px] leading-relaxed text-ink-500 dark:text-slate-300">{t(editing ? 'postJob.savedText' : 'postJob.liveText').replace('{title}', title.trim())}</p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <Link href={`/jobs/${publishedId}`} className={solid}>{t('postJob.view')}</Link>
            <Link href="/employer" className={outline}>{t('postJob.dashboard')}</Link>
          </div>
        </section>
      </div>
    );
  }

  const min = Number(salaryMin);
  const max = Number(salaryMax);
  const pay = min && max ? `ETB ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}` : max || min ? `ETB ${(max || min).toLocaleString('en-US')}` : '';
  // Editing doesn't use a post, and a job that is already featured may stay featured.
  const atLimit = !editing && plan?.maxPosts != null && used != null && used >= plan.maxPosts;
  const canFeature = Boolean(plan?.canFeature || saved?.featured);
  const percent = plan?.maxPosts && used != null ? Math.min(100, Math.round((used / plan.maxPosts) * 100)) : null;

  function addTag() {
    const tag = tagDraft.trim().replace(/,$/, '');
    if (tag && !tags.some((item) => item.toLowerCase() === tag.toLowerCase())) setTags([...tags, tag]);
    setTagDraft('');
  }

  function onTagKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  }

  function problem(): string {
    if (title.trim().length < 3) return t('postJob.errTitle');
    if (!categoryId) return t('postJob.errCategory');
    if (!location.trim()) return t('postJob.errLocation');
    if (min && max && max < min) return t('postJob.errSalary');
    if (description.trim().length < MIN_DESCRIPTION) return t('postJob.errDescription');
    return '';
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    const issue = problem();
    setError(issue);
    if (issue) return;
    setPublishing(true);
    // An edit sends null so a field the employer emptied is cleared, not left as it was.
    const empty = editing ? null : undefined;
    try {
      const response = await authenticatedFetch(editing ? `${API_URL}/jobs/${editId}` : `${API_URL}/jobs`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || empty,
          location: location.trim(),
          type,
          categoryId,
          salaryMin: min || empty,
          salaryMax: max || empty,
          salaryType,
          vacancies: Number(vacancies) || 1,
          experienceLevel: experienceLevel || empty,
          yearsOfExperience: years.trim() || empty,
          qualification: qualification.trim() || empty,
          tags,
          deadline: deadline || empty,
          // Applications always come through Beleqet; saving an older job also clears its link or email.
          applyType: empty,
          applyUrl: empty,
          applyEmail: empty,
          featured: canFeature ? featured : undefined,
          urgent,
        }),
      });
      // A 403 is the plan's job limit or an unconfirmed email; errorText shows which.
      if (!response.ok) throw await apiError(response);
      const job = await response.json();
      setPublishedId(job.id);
      window.scrollTo({ top: 0 });
    } catch (problem) {
      setError(errorText(problem, t, editing ? 'postJob.saveFailed' : 'postJob.publishFailed'));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form noValidate onSubmit={publish} className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-6 px-4 py-6 md:px-[clamp(16px,4vw,40px)] md:py-10">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-ink-900 dark:text-white">{t(editing ? 'postJob.editTitle' : 'postJob.title')}</h1>

        <Section title={t('postJob.basics')}>
          <Field label={t('postJob.jobTitle')}>
            <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} className={input} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('postJob.category')}>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={input}>
                <option value="">{t('postJob.chooseCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </Field>
            <Field label={t('postJob.location')}>
              <input type="text" value={location} onChange={(event) => setLocation(event.target.value)} className={input} />
            </Field>
          </div>
          <Field label={t('postJob.openings')}>
            <input type="number" min={1} value={vacancies} onChange={(event) => setVacancies(event.target.value)} className={`${input} md:max-w-[200px]`} />
          </Field>
          <fieldset>
            <legend className={`${labelText} pb-2`}>{t('postJob.jobType')}</legend>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={type === code}
                  onClick={() => setType(code)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${type === code ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                >
                  {t(`search.types.${code}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title={t('postJob.salary')}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('freelance.post2.minimum')}>
              <input type="number" min={0} value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} className={input} />
            </Field>
            <Field label={t('freelance.post2.maximum')}>
              <input type="number" min={0} value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} className={input} />
            </Field>
            <Field label={t('postJob.paid')}>
              <select value={salaryType} onChange={(event) => setSalaryType(event.target.value as typeof salaryType)} className={input}>
                {PAY_PERIODS.map((period) => (
                  <option key={period} value={period}>{t(`postJob.periods.${period}`)}</option>
                ))}
              </select>
            </Field>
          </div>
          <span className={hint}>{t('postJob.salaryHint')}</span>
        </Section>

        <Section title={t('postJob.descriptionTitle')}>
          <Field label={t('postJob.about')}>
            <textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className={`${input} resize-y py-3 leading-normal`} />
          </Field>
          <Field label={t('postJob.requirements')}>
            <textarea rows={5} value={requirements} onChange={(event) => setRequirements(event.target.value)} className={`${input} resize-y py-3 leading-normal`} />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('postJob.experience')}>
              <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className={input}>
                <option value="">{t('postJob.notSpecified')}</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>{t(`postJob.levels.${level}`)}</option>
                ))}
                {/* Older and imported jobs may use a level outside the list; keep it selectable. */}
                {experienceLevel && !(LEVELS as readonly string[]).includes(experienceLevel) && <option value={experienceLevel}>{experienceLevel}</option>}
              </select>
            </Field>
            <Field label={t('postJob.years')}>
              <input type="text" value={years} onChange={(event) => setYears(event.target.value)} className={input} />
            </Field>
            <Field label={t('postJob.qualification')}>
              <input type="text" value={qualification} onChange={(event) => setQualification(event.target.value)} className={input} />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <span className={labelText}>{t('postJob.skills')}</span>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-300 p-2 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F6] py-1 pl-3 pr-1 text-sm font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                  {tag}
                  <button type="button" aria-label={t('freelance.post2.removeSkill').replace('{skill}', tag)} onClick={() => setTags(tags.filter((item) => item !== tag))} className="grid h-7 w-7 place-items-center rounded-full">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                aria-label={t('freelance.post2.addSkill')}
                placeholder={t('freelance.post2.addSkill')}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={onTagKey}
                onBlur={addTag}
                className="min-h-9 min-w-[140px] flex-1 bg-transparent px-1.5 text-base text-ink-900 outline-none dark:text-white"
              />
            </div>
          </div>
        </Section>

        <Section title={t('postJob.applyTitle')}>
          <p className="flex flex-col gap-0.5 rounded-[10px] border border-ink-300 p-3.5 dark:border-slate-700">
            <b className="text-[15px] text-ink-900 dark:text-white">{t('postJob.methods.internal.label')}</b>
            <span className={hint}>{t('postJob.methods.internal.text')}</span>
          </p>
          <Field label={t('postJob.deadline')}>
            <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className={`${input} md:max-w-[240px]`} />
          </Field>
        </Section>

        <Section title={t('postJob.visibility')}>
          <label className={`flex items-start gap-3 ${canFeature ? 'cursor-pointer' : 'opacity-70'}`}>
            <input type="checkbox" disabled={!canFeature} checked={featured} onChange={(event) => setFeatured(event.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">
                {t('postJob.feature')} <span className="ml-1 rounded bg-limeAccent px-1.5 py-0.5 text-[11px] font-extrabold text-obsidian">PRO</span>
              </b>
              <span className={hint}>{t(canFeature ? 'postJob.featureText' : 'postJob.featureLocked')}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">{t('postJob.urgent')}</b>
              <span className={hint}>{t('postJob.urgentText')}</span>
            </span>
          </label>
        </Section>
      </div>

      <aside className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-4 md:sticky md:top-[88px] md:max-w-[380px]">
        <section aria-label={t('postJob.preview')} className={`flex flex-col gap-2.5 rounded-xl border bg-surface p-5 dark:bg-slate-900 ${featured ? 'border-[#B9D88A] dark:border-limeAccent/40' : 'border-ink-200 dark:border-slate-800'}`}>
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink-500 dark:text-slate-400">{t('postJob.preview')}</span>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">{initials(company.name)}</span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <b className="break-words text-base text-ink-900 dark:text-white">{title.trim() || t('postJob.previewTitle')}</b>
                {featured && <span className="rounded-md bg-limeAccent px-2 py-0.5 text-[11px] font-extrabold uppercase text-obsidian">{t('search.featured')}</span>}
              </span>
              <span className="text-sm text-ink-500 dark:text-slate-300">{[company.name, location.trim(), t(`search.types.${type}`)].filter(Boolean).join(' · ')}</span>
              {pay && <b className="text-sm text-ink-900 dark:text-white">{pay} / {t(`postJob.units.${salaryType}`)}</b>}
            </span>
          </div>
        </section>

        <section className={card}>
          {plan && !editing && (
            <div className="flex flex-col gap-2">
              <span className="flex justify-between gap-3 text-sm">
                <span className="text-ink-500 dark:text-slate-400">{t('postJob.planName').replace('{plan}', plan.name)}</span>
                {plan.maxPosts != null && used != null && (
                  <b className="text-ink-900 dark:text-white">{t('postJob.postsUsed').replace('{used}', String(used)).replace('{max}', String(plan.maxPosts))}</b>
                )}
              </span>
              {percent != null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F4F6] dark:bg-slate-800">
                  <div className="h-1.5 bg-forest dark:bg-limeAccent" style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
          )}
          {atLimit && (
            <p className="text-sm text-ink-700 dark:text-slate-300">
              {t('postJob.limitReached')} <Link href="/pricing" className="font-bold text-forest hover:underline dark:text-limeAccent">{t('dash.seePlans')}</Link>
            </p>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          {editing ? (
            <>
              <button type="submit" disabled={publishing} className={solid}>{t(publishing ? 'postJob.saving' : 'postJob.save')}</button>
              <Link href="/employer?tab=jobs" className={outline}>{t('postJob.cancel')}</Link>
            </>
          ) : (
            <>
              <button type="submit" disabled={publishing || atLimit} className={solid}>{t(publishing ? 'freelance.post2.publishing' : 'postJob.publish')}</button>
              <span className={hint}>{t('postJob.editNote')}</span>
            </>
          )}
        </section>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-ink-900 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className={labelText}>{label}</span>
      {children}
    </label>
  );
}

function Gate({ title, text, action, href }: { title: string; text: string; action: string; href: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[560px] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white">{title}</h1>
      <p className="text-[15px] leading-relaxed text-ink-500 dark:text-slate-300">{text}</p>
      <Link href={href} className={solid}>{action}</Link>
    </div>
  );
}
