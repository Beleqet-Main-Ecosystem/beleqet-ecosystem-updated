/**
 * Jobs and platform API for the beleqet-jobs-nextjs web frontend.
 *
 * Core domain types are imported from @beleqet/common so this file stays
 * in sync with the backend DTOs automatically.
 */

import axios from 'axios';
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
  companyVerified?: boolean;
  companyIndustry?: string | null;
  location: string;
  /** Human-readable job type (e.g. "Full Time"). */
  type: string;
  /** Category display name or slug. */
  category: string;
  categorySlug?: string;
  /** Relative time string, e.g. "3h ago". */
  postedAgo: string;
  featured?: boolean;
  urgent?: boolean;
  description?: string;
  requirements?: string;
  tags?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
  experienceLevel?: string | null;
  yearsOfExperience?: string | null;
  vacancies?: number | null;
  deadline?: string | null;
  applicationsCount?: number;
  relevanceScore?: number;
  createdAt?: string | null;
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

/** Map a canonical backend Job to the web display Job. */
function toDisplayJob(raw: any): Job {
  return {
    id: raw.id,
    title: raw.title,
    company: raw.company?.name ?? raw.companyName ?? 'Confidential',
    companyLogo: raw.company?.logoUrl ?? raw.companyLogo ?? null,
    companyVerified: Boolean(raw.company?.verified),
    companyIndustry: raw.company?.industry ?? null,
    location: raw.location ?? 'Addis Ababa',
    type: (raw.type && typeLabels[raw.type]) ?? raw.type ?? 'Full Time',
    category: raw.category?.label ?? raw.category?.slug ?? raw.categoryId ?? 'General',
    categorySlug: raw.category?.slug ?? raw.categoryId ?? '',
    postedAgo: relativeTime(raw.createdAt),
    featured: Boolean(raw.featured),
    urgent: Boolean(raw.urgent),
    description: raw.description ?? '',
    requirements: raw.requirements ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    currency: raw.currency ?? 'ETB',
    experienceLevel: raw.experienceLevel ?? null,
    yearsOfExperience: raw.yearsOfExperience ?? null,
    vacancies: typeof raw.vacancies === 'number' ? raw.vacancies : null,
    deadline: raw.deadline
      ? new Date(raw.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : raw.expiryDate
      ? new Date(raw.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null,
    applicationsCount: raw._count?.applications ?? 0,
    relevanceScore: raw.relevanceScore,
    createdAt: raw.createdAt,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

/** Fetch paginated job listings. */
export async function fetchJobs(params?: QueryJobsDto): Promise<Job[]> {
  try {
    const { data } = await api.get<JobsResponse>('/jobs', {
      params: { limit: 60, ...params },
    });
    return (data.items ?? []).map(toDisplayJob);
  } catch {
    return [];
  }
}

/** Fetch a single job by ID. */
export async function fetchJob(id: string): Promise<Job | null> {
  try {
    const { data } = await api.get<CommonJob>(`/jobs/${id}`);
    return toDisplayJob(data);
  } catch {
    return null;
  }
}

/** Fetch all job categories. */
export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await api.get<JobCategory[]>('/jobs/categories');
    return (data ?? []).map((c) => ({
      id: c.slug ?? c.id,
      label: c.label,
      icon: c.icon ?? 'briefcase',
    }));
  } catch {
    return [];
  }
}

/** Fetch all active subscription plans. */
export async function fetchPlans(): Promise<CommonPlan[]> {
  try {
    const { data } = await api.get<CommonPlan[]>('/plans');
    return data ?? [];
  } catch {
    return [];
  }
}

/** Fetch live platform statistics from `GET /jobs/stats`. */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  try {
    const { data } = await api.get<PlatformStats>('/jobs/stats');
    return data;
  } catch {
    return {
      activeJobs: 10000,
      hiringCompanies: 5000,
      registeredJobSeekers: 50000,
      satisfactionRate: 98,
    };
  }
}
