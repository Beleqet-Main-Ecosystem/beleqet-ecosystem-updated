/**
 * Jobs: search, detail, categories, applying, saving. The mapping matches the website's
 * toDisplayJob, so both show the same thing for the same listing.
 */
import { get, send } from '../lib/api';
import { toApiError } from '../lib/api-error';

export type Job = {
  id: string;
  title: string;
  company: string;
  companyId: string | null;
  companyLogo: string | null;
  companyWebsite: string | null;
  companyDescription: string | null;
  companyVerified: boolean;
  companyIndustry: string | null;
  companySize: string | null;
  location: string;
  /** FULL_TIME, PART_TIME, REMOTE, HYBRID, CONTRACT. */
  typeCode: string;
  category: string;
  categoryLabel: string;
  featured: boolean;
  urgent: boolean;
  description: string;
  requirements: string | null;
  experienceLevel: string | null;
  vacancies: number;
  salaryType: string;
  tags: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  createdAt: string | null;
  applicantCount: number;
  closesAt: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJob(raw: any): Job {
  return {
    id: raw.id,
    title: raw.title ?? '',
    company: raw.company?.name ?? raw.companyName ?? 'Confidential',
    companyId: raw.companyId ?? raw.company?.id ?? null,
    companyLogo: raw.companyLogo ?? raw.company?.logoUrl ?? null,
    companyWebsite: raw.company?.website ?? null,
    companyDescription: raw.company?.description ?? null,
    companyVerified: Boolean(raw.company?.verified),
    companyIndustry: raw.company?.industry ?? null,
    companySize: raw.company?.size ?? null,
    location: raw.location ?? '',
    typeCode: raw.type ?? '',
    category: raw.category?.slug ?? raw.categoryId ?? '',
    categoryLabel: raw.category?.label ?? raw.category?.slug ?? '',
    featured: Boolean(raw.featured),
    urgent: Boolean(raw.urgent),
    description: raw.description ?? '',
    requirements: raw.requirements ?? null,
    experienceLevel: raw.experienceLevel ?? null,
    vacancies: raw.vacancies ?? 1,
    salaryType: raw.salaryType ?? 'Monthly',
    tags: raw.tags ?? [],
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    currency: raw.currency ?? 'ETB',
    createdAt: raw.createdAt ?? null,
    applicantCount: raw._count?.applications ?? 0,
    closesAt: raw.deadline ?? raw.expiryDate ?? null,
  };
}

export type Page<T> = { items: T[]; total: number; page: number; totalPages: number };

/** A 200 that isn't a list (e.g. a proxy's HTML page) is an error, never "no results". */
function list<T>(data: unknown, map: (raw: unknown) => T, page = 1, limit = 20): Page<T> {
  const body = data as { items?: unknown[]; total?: number; page?: number; totalPages?: number } | null;
  if (!body || !Array.isArray(body.items)) throw toApiError(new Error('Unexpected response'));
  const total = body.total ?? body.items.length;
  return {
    items: body.items.map(map),
    total,
    page: body.page ?? page,
    totalPages: body.totalPages ?? Math.max(1, Math.ceil(total / limit)),
  };
}
export { list as toPage };

export type JobSearch = {
  q?: string;
  location?: string;
  category?: string;
  company?: string;
  types?: string[];
  /** Minimum salary in ETB. */
  salaryMin?: number;
  experienceLevel?: string;
  /** Posted within this many days. */
  postedWithin?: number;
  sort?: 'newest' | 'salary';
  page?: number;
  limit?: number;
};

/** The same choices as the website's job filters (features/jobs/search-params.ts). */
export const SALARY_STEPS = [5000, 10000, 20000, 40000];
export const EXPERIENCE_LEVELS = ['Entry level', 'Junior', 'Mid-level', 'Senior'];
export const POSTED_WITHIN = [1, 7, 30];

export async function searchJobs(search: JobSearch): Promise<Page<Job>> {
  const limit = search.limit ?? 20;
  const data = await get('/jobs', {
    q: search.q || undefined,
    location: search.location || undefined,
    category: search.category || undefined,
    company: search.company || undefined,
    type: search.types?.join(',') || undefined,
    salaryMin: search.salaryMin || undefined,
    experienceLevel: search.experienceLevel || undefined,
    postedWithin: search.postedWithin || undefined,
    sort: search.sort === 'salary' ? 'salary' : undefined,
    page: search.page ?? 1,
    limit,
  });
  return list(data, toJob, search.page ?? 1, limit);
}

export async function fetchJob(id: string): Promise<Job> {
  return toJob(await get(`/jobs/${encodeURIComponent(id)}`));
}

export type Category = { id: string; slug: string; label: string; openJobs: number };

export async function fetchJobCategories(): Promise<Category[]> {
  const data = await get<{ id: string; slug?: string; label: string; openJobs?: number }[]>('/jobs/categories');
  if (!Array.isArray(data)) return [];
  return data.map((c) => ({ id: c.id, slug: c.slug ?? c.id, label: c.label, openJobs: c.openJobs ?? 0 }));
}

export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'REMOTE', 'HYBRID', 'CONTRACT'] as const;

// ── Applying ───────────────────────────────────────────────────────────────────

export function applyToJob(input: { jobId: string; resumeUrl?: string; coverLetter?: string; portfolioUrl?: string; expectedSalary?: number }) {
  return send<{ id: string }>('POST', '/applications', input);
}

// ── Saved jobs ─────────────────────────────────────────────────────────────────

export type SavedJob = { id: string; jobId: string; createdAt: string; job: Job };

export async function fetchSavedJobs(): Promise<SavedJob[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await get<any[]>('/users/saved-jobs');
  return (rows ?? []).map((row) => ({ id: row.id, jobId: row.jobId ?? row.job?.id, createdAt: row.createdAt, job: toJob(row.job ?? {}) }));
}

export const saveJob = (jobId: string) => send('POST', `/users/saved-jobs/${encodeURIComponent(jobId)}`);
export const unsaveJob = (jobId: string) => send('DELETE', `/users/saved-jobs/${encodeURIComponent(jobId)}`);
