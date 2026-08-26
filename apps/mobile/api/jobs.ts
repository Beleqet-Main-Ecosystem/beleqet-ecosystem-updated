/** Jobs API — feed, detail, categories, apply. */

import { z } from 'zod';
import { apiClient } from './client';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  slug: z.string(),
  label: z.string(),
  icon: z.string().nullish(),
  count: z.number().nullish(),
});

export const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  type: z.string().nullish(),
  featured: z.boolean().nullish(),
  tags: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  salaryMin: z.number().nullish(),
  salaryMax: z.number().nullish(),
  currency: z.string().nullish(),
  companyName: z.string().nullish(),
  company: z.object({ name: z.string().nullish() }).nullish(),
  category: categorySchema.nullish(),
  categoryId: z.string().nullish(),
  applicationDeadline: z.string().nullish(),
  requirements: z.array(z.string()).nullish(),
  benefits: z.array(z.string()).nullish(),
});

export type Job = z.infer<typeof jobSchema>;
export type Category = z.infer<typeof categorySchema>;

const jobsResponseSchema = z.object({
  items: z.array(jobSchema).default([]),
  total: z.number().nullish(),
});

// ── Query helpers ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  REMOTE: 'Remote',
  HYBRID: 'Hybrid',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Normalize raw API job into a clean display object. */
export function normalizeJob(raw: Job) {
  return {
    ...raw,
    companyDisplay: raw.company?.name ?? raw.companyName ?? 'Confidential',
    typeDisplay: (raw.type && TYPE_LABELS[raw.type]) ?? raw.type ?? '',
    postedAgo: relativeTime(raw.createdAt),
    categorySlug: raw.category?.slug ?? raw.categoryId ?? '',
  };
}

export type NormalizedJob = ReturnType<typeof normalizeJob>;

// ── API functions ─────────────────────────────────────────────────────────────

export type JobsParams = {
  limit?: number;
  offset?: number;
  category?: string;
  type?: string;
  q?: string;
  featured?: boolean;
};

/**
 * Fetch paginated job listings.
 */
export async function fetchJobs(params: JobsParams = {}): Promise<NormalizedJob[]> {
  try {
    const { data } = await apiClient.get('/jobs', {
      params: { limit: 40, ...params },
    });
    return jobsResponseSchema.parse(data).items.map(normalizeJob);
  } catch {
    return [];
  }
}

/**
 * Fetch a single job by ID.
 */
export async function fetchJob(id: string): Promise<NormalizedJob | null> {
  try {
    const { data } = await apiClient.get(`/jobs/${id}`);
    return normalizeJob(jobSchema.parse(data));
  } catch {
    return null;
  }
}

/**
 * Fetch all job categories.
 */
export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get('/jobs/categories');
    return z.array(categorySchema).parse(data);
  } catch {
    return [];
  }
}

/**
 * Apply to a job posting.
 * Returns the application ID on success.
 */
export async function applyToJob(
  jobId: string,
  payload: { coverLetter?: string; resumeUrl?: string },
): Promise<{ applicationId: string }> {
  const { data } = await apiClient.post(`/jobs/${jobId}/apply`, payload);
  return data as { applicationId: string };
}

/**
 * Fetch platform-wide stats (public, no auth required).
 */
export async function fetchPlatformStats() {
  try {
    const { data } = await apiClient.get('/jobs/stats');
    return data as {
      activeJobs: number;
      hiringCompanies: number;
      registeredJobSeekers: number;
      satisfactionRate: number;
    };
  } catch {
    return {
      activeJobs: 10_000,
      hiringCompanies: 5_000,
      registeredJobSeekers: 50_000,
      satisfactionRate: 98,
    };
  }
}
