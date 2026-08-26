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
  location: string;
  /** Human-readable job type (e.g. "Full Time"). */
  type: string;
  /** Category slug for routing. */
  category: string;
  /** Relative time string, e.g. "3h ago". */
  postedAgo: string;
  featured?: boolean;
  description?: string;
  tags?: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string;
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
function toDisplayJob(raw: CommonJob): Job {
  return {
    id: raw.id,
    title: raw.title,
    company: raw.company?.name ?? 'Confidential',
    location: raw.location ?? '',
    type: (raw.type && typeLabels[raw.type]) ?? raw.type ?? '',
    category: raw.category?.slug ?? raw.categoryId ?? '',
    postedAgo: relativeTime(raw.createdAt),
    featured: raw.featured ?? false,
    description: raw.description ?? '',
    tags: raw.tags ?? [],
    salaryMin: raw.salaryMin,
    salaryMax: raw.salaryMax,
    currency: raw.currency,
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
export async function fetchCategories(): Promise<JobCategory[]> {
  try {
    const { data } = await api.get<JobCategory[]>('/jobs/categories');
    return data ?? [];
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
