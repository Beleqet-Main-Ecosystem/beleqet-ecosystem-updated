/**
 * Jobs and platform API for the beleqet-jobs-nextjs web frontend.
 *
 * Core domain types are imported from @beleqet/common so this file stays
 * in sync with the backend DTOs automatically.
 */

import axios from 'axios';
import { cache } from 'react';
import { describeError } from './build-safe';
import type {
  Job as CommonJob,
  JobCategory,
  JobsResponse,
  JobStats,
  Plan as CommonPlan,
  QueryJobsDto,
} from '@beleqet/common';

// ── Re-export canonical types so app code imports from one place ──────────────

export type { JobCategory, QueryJobsDto };

/**
 * Display-enriched Category used by UI components (CategoryGrid, JobsListing).
 * Wraps JobCategory with a mandatory icon string and optional display count.
 */
export type Category = {
  id: string;
  label: string;
  icon: string;
  count?: string;
};

// ── Display-enriched Job (web-specific presentation layer) ────────────────────

/**
 * Job shape used by the web UI. Extends the canonical Job with
 * pre-formatted display fields so components stay logic-free.
 */
export type Job = {
  id: string;
  title: string;
  /** Resolved company display name. */
  company: string;
  companyLogo?: string | null;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  companyVerified?: boolean;
  companyIndustry?: string | null;
  companySize?: string | null;
  location: string;
  /** Human-readable job type (e.g. "Full Time"). */
  type: string;
  /** API job type code (e.g. "FULL_TIME"), for translated labels. */
  typeCode?: string;
  /** Category slug for routing. */
  category: string;
  categoryLabel?: string;
  /** Relative time string, e.g. "3h ago". */
  postedAgo: string;
  featured?: boolean;
  urgent?: boolean;
  description?: string;
  requirements?: string | null;
  experienceLevel?: string | null;
  vacancies?: number | null;
  expiryDate?: string | null;
  salaryType?: string | null;
  tags?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  relevanceScore?: number;
  createdAt?: string | null;
  applicantCount?: number;
  /** How candidates apply: on Beleqet, on the employer's site, or by email. */
  applyMethod?: 'internal' | 'external' | 'email';
  applyUrl?: string | null;
  applyEmail?: string | null;
  /** ISO date applications close (deadline, else expiry), if any. */
  closesAt?: string | null;
};

/** Platform subscription plan — re-exported from @beleqet/common. */
export type { CommonPlan as Plan };

/** Platform statistics shape from `GET /jobs/stats`. */
export type PlatformStats = JobStats;

// ── Internal helpers ──────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1',
  timeout: 10000,
});

const typeLabels: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  CONTRACT: 'Contract',
};

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Imported jobs use "external" / "with_email"; jobs posted on Beleqet leave applyType empty. */
function toApplyMethod(raw: any): 'internal' | 'external' | 'email' {
  const type = String(raw.applyType ?? '').toLowerCase();
  if ((type === 'external' || type === 'url') && raw.applyUrl) return 'external';
  if ((type === 'with_email' || type === 'email') && raw.applyEmail) return 'email';
  return 'internal';
}

/** Map a canonical backend Job to the web display Job. */
function toDisplayJob(raw: any): Job {
  return {
    id: raw.id,
    title: raw.title,
    company: raw.company?.name ?? raw.companyName ?? 'Confidential',
    companyLogo: raw.companyLogo ?? raw.company?.logoUrl ?? null,
    companyWebsite: raw.company?.website ?? null,
    companyDescription: raw.company?.description ?? null,
    companyVerified: Boolean(raw.company?.verified),
    companyIndustry: raw.company?.industry ?? null,
    companySize: raw.company?.size ?? null,
    location: raw.location ?? '',
    type: (raw.type && typeLabels[raw.type]) ?? raw.type ?? '',
    typeCode: raw.type ?? undefined,
    category: raw.category?.slug ?? raw.categoryId ?? '',
    categoryLabel: raw.category?.label ?? raw.category?.slug ?? '',
    postedAgo: relativeTime(raw.createdAt),
    featured: Boolean(raw.featured),
    urgent: Boolean(raw.urgent),
    description: raw.description ?? '',
    requirements: raw.requirements ?? null,
    experienceLevel: raw.experienceLevel ?? null,
    vacancies: raw.vacancies ?? 1,
    expiryDate: raw.expiryDate
      ? new Date(raw.expiryDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
    salaryType: raw.salaryType ?? 'Monthly',
    tags: raw.tags ?? [],
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    currency: raw.currency ?? 'ETB',
    createdAt: raw.createdAt,
    applicantCount: raw._count?.applications ?? 0,
    applyMethod: toApplyMethod(raw),
    applyUrl: raw.applyUrl ?? null,
    applyEmail: raw.applyEmail ?? null,
    closesAt: raw.deadline ?? raw.expiryDate ?? null,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * A 200 response is not always data: a proxy (e.g. a Cloudflare challenge) can
 * answer with an HTML page. Treating that as "no items" would show an empty
 * list as if it were true, so anything without an `items` array is an error.
 */
function assertListResponse<T extends { items?: unknown }>(data: T, label: string): T & { items: unknown[] } {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    const preview = typeof data === 'string' ? (data as string).slice(0, 80).replace(/\s+/g, ' ') : typeof data;
    throw new Error(`${label}: unexpected response (${preview})`);
  }
  return data as T & { items: unknown[] };
}

/** Fetch paginated job listings. */
export async function fetchJobs(params?: QueryJobsDto): Promise<Job[]> {
  try {
    const { data } = await api.get<JobsResponse>('/jobs', {
      params: { limit: 9, ...params },
    });
    return assertListResponse(data, 'GET /jobs').items.map(toDisplayJob);
  } catch (err) {
    console.error(`[api] fetchJobs failed: ${describeError(err)}`);
    throw err;
  }
}

export type JobSearchResult = {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
};

/** Search published jobs with server-side filters and pagination (featured first, then newest). */
export async function searchJobs(params: QueryJobsDto): Promise<JobSearchResult> {
  try {
    const { data: raw } = await api.get<JobsResponse & { page?: number; totalPages?: number }>('/jobs', { params });
    const data = assertListResponse(raw, 'GET /jobs');
    const limit = params.limit ?? 20;
    const total = data.total ?? data.items.length;
    return {
      jobs: data.items.map(toDisplayJob),
      total,
      page: data.page ?? params.page ?? 1,
      totalPages: data.totalPages ?? Math.max(1, Math.ceil(total / limit)),
    };
  } catch (err) {
    console.error(`[api] searchJobs failed: ${describeError(err)}`);
    throw err;
  }
}

/**
 * Fetch a single job by ID. Returns null only when the API says the job does
 * not exist; other failures rethrow so ISR keeps the cached page instead of
 * caching a 404 for a job that is still live.
 */
export const fetchJob = cache(async function fetchJob(id: string): Promise<Job | null> {
  try {
    const { data } = await api.get<CommonJob>(`/jobs/${id}`);
    return toDisplayJob(data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    console.error(`[api] fetchJob(${id}) failed: ${describeError(err)}`);
    throw err;
  }
});

/** Open freelance project, trimmed to what listing cards show. */
export type Gig = {
  id: string;
  title: string;
  categoryLabel: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  pricingType: string;
  bidCount: number;
  postedAgo: string;
  categorySlug: string;
  skills: string[];
  description: string;
  deadlineDays: number | null;
  featured: boolean;
  /** Status FUNDED: the client's money is already in escrow. */
  funded: boolean;
  createdAt: string | null;
};

function toGig(raw: any): Gig {
  return {
    id: raw.id,
    title: raw.title,
    categoryLabel: raw.category?.label ?? '',
    budgetMin: raw.budgetMin ?? 0,
    budgetMax: raw.budgetMax ?? 0,
    currency: raw.currency ?? 'ETB',
    pricingType: raw.pricingType ?? 'FIXED',
    bidCount: raw._count?.bids ?? 0,
    postedAgo: relativeTime(raw.createdAt),
    categorySlug: raw.category?.slug ?? '',
    skills: raw.skills ?? [],
    description: raw.description ?? '',
    deadlineDays: raw.deadlineDays ?? null,
    featured: Boolean(raw.featured),
    funded: raw.status === 'FUNDED',
    createdAt: raw.createdAt ?? null,
  };
}

/** Fetch open freelance projects, featured first, then newest. */
export async function fetchOpenGigs(limit = 4): Promise<Gig[]> {
  return (await searchGigs({ limit })).gigs;
}

export type GigSearchResult = {
  gigs: Gig[];
  total: number;
  page: number;
  totalPages: number;
};

/** Search open projects with the API's filters (featured first, then newest). */
export async function searchGigs(params: { q?: string; category?: string; page?: number; limit?: number }): Promise<GigSearchResult> {
  try {
    const { data: raw } = await api.get<{ items?: any[]; total?: number; page?: number; totalPages?: number }>('/freelance/jobs', { params });
    const data = assertListResponse(raw, 'GET /freelance/jobs');
    const total = data.total ?? data.items.length;
    return {
      gigs: data.items.map(toGig),
      total,
      page: data.page ?? params.page ?? 1,
      totalPages: data.totalPages ?? 1,
    };
  } catch (err) {
    console.error(`[api] searchGigs failed: ${describeError(err)}`);
    throw err;
  }
}

export type GigDetail = Gig & {
  clientId: string;
  clientName: string;
  experienceLevel: string | null;
  locationPreference: string | null;
  attachments: string[];
  /** Still taking bids. */
  open: boolean;
};

/**
 * Fetch one project, or null when the API says it does not exist. The API's
 * bids are left out on purpose: they hold cover letters and prices that must
 * not reach the public page.
 */
export const fetchGig = cache(async function fetchGig(id: string): Promise<GigDetail | null> {
  try {
    const { data: raw } = await api.get<any>(`/freelance/jobs/${encodeURIComponent(id)}`);
    const first = raw.client?.firstName ?? '';
    const last = raw.client?.lastName ?? '';
    return {
      ...toGig({ ...raw, _count: { bids: raw.bids?.length ?? 0 } }),
      clientId: raw.clientId,
      clientName: `${first} ${last ? `${last.charAt(0)}.` : ''}`.trim(),
      experienceLevel: raw.experienceLevel ?? null,
      locationPreference: raw.locationPreference ?? null,
      attachments: raw.attachments ?? [],
      open: raw.status === 'OPEN' || raw.status === 'FUNDED',
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    console.error(`[api] fetchGig failed: ${describeError(err)}`);
    throw err;
  }
});

export type GigCategory = { id: string; slug: string; label: string };

/** Freelance categories, without the rows test runs leave behind. */
export async function fetchGigCategories(): Promise<GigCategory[]> {
  try {
    const { data } = await api.get<GigCategory[]>('/freelance/categories');
    return Array.isArray(data) ? data.filter((c) => !c.slug.startsWith('gdpr-test')) : [];
  } catch (err) {
    console.error(`[api] fetchGigCategories failed: ${describeError(err)}`);
    return [];
  }
}

/** Fetch all job categories. */
// Categories change rarely and every listing page needs them, so the server
// keeps them for an hour and serves the last good list if a refresh fails.
const CATEGORIES_TTL_MS = 60 * 60 * 1000;
let categoriesCache: { at: number; value: Category[] } | null = null;

export async function fetchCategories(): Promise<Category[]> {
  if (categoriesCache && Date.now() - categoriesCache.at < CATEGORIES_TTL_MS) return categoriesCache.value;
  try {
    const { data } = await api.get<JobCategory[]>('/jobs/categories');
    if (!Array.isArray(data)) throw new Error('GET /jobs/categories: unexpected response');
    const value = data.map((c) => ({
      id: c.slug ?? c.id,
      label: c.label,
      icon: c.icon ?? 'briefcase',
    }));
    if (value.length > 0) categoriesCache = { at: Date.now(), value };
    return value;
  } catch (err) {
    console.error(`[api] fetchCategories failed: ${describeError(err)}`);
    return categoriesCache?.value ?? [];
  }
}

/** Fetch all active subscription plans. */
export async function fetchPlans(): Promise<CommonPlan[]> {
  try {
    const { data } = await api.get<CommonPlan[]>('/plans');
    return data ?? [];
  } catch (err) {
    console.error(`[api] fetchPlans failed: ${describeError(err)}`);
    return [];
  }
}

/** Fetch live platform statistics from `GET /jobs/stats`. */
export async function fetchPlatformStats(): Promise<PlatformStats | null> {
  try {
    const { data } = await api.get<PlatformStats>('/jobs/stats');
    return data;
  } catch (err) {
    console.error(`[api] fetchPlatformStats failed: ${describeError(err)}`);
    return null;
  }
}


/**
 * Builds a clean search URL with query parameters.
 * Used by search forms and popular-search link chips.
 */
export function buildSearchUrl(q: string = '', loc: string = '', type: 'jobs' | 'freelance' = 'jobs'): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (loc.trim()) params.set('loc', loc.trim());
  const queryString = params.toString();
  const basePath = type === 'freelance' ? '/freelance' : '/jobs';
  return queryString ? `${basePath}?${queryString}` : basePath;
}
