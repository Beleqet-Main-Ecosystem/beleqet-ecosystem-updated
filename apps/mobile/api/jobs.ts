/**
 * Jobs API — feed, detail, categories, apply.
 *
 * Types imported from @beleqet/common keep mobile aligned with the backend.
 */

import type {
  Job,
  JobCategory,
  JobsResponse,
  JobStats,
  QueryJobsDto,
  CreateApplicationDto,
} from '@beleqet/common';
import { JobType } from '@beleqet/common';
import { apiClient } from './client';

// Re-export for consumers.
export type { Job, JobCategory, QueryJobsDto };

// ── Display helpers ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  [JobType.FULL_TIME]: 'Full Time',
  [JobType.PART_TIME]: 'Part Time',
  [JobType.REMOTE]:    'Remote',
  [JobType.HYBRID]:    'Hybrid',
  [JobType.CONTRACT]:  'Contract',
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

/** Normalize a raw API job into a clean display object. */
export function normalizeJob(job: Job) {
  return {
    ...job,
    companyDisplay: job.company?.name ?? 'Confidential',
    typeDisplay:    (job.type && TYPE_LABELS[job.type]) ?? job.type ?? '',
    postedAgo:      relativeTime(job.createdAt),
    categorySlug:   job.category?.slug ?? job.categoryId ?? '',
  };
}

export type NormalizedJob = ReturnType<typeof normalizeJob>;

// ── API functions ─────────────────────────────────────────────────────────────

/** Fetch paginated job listings. */
export async function fetchJobs(params: QueryJobsDto = {}): Promise<NormalizedJob[]> {
  try {
    const { data } = await apiClient.get<JobsResponse>('/jobs', {
      params: { limit: 40, ...params },
    });
    return (data.items ?? []).map(normalizeJob);
  } catch {
    return [];
  }
}

/** Fetch a single job by ID. */
export async function fetchJob(id: string): Promise<NormalizedJob | null> {
  try {
    const { data } = await apiClient.get<Job>(`/jobs/${id}`);
    return normalizeJob(data);
  } catch {
    return null;
  }
}

/** Fetch all job categories. */
export async function fetchCategories(): Promise<JobCategory[]> {
  try {
    const { data } = await apiClient.get<JobCategory[]>('/jobs/categories');
    return data ?? [];
  } catch {
    return [];
  }
}

/** Fetch platform-wide stats. */
export async function fetchPlatformStats(): Promise<JobStats> {
  try {
    const { data } = await apiClient.get<JobStats>('/jobs/stats');
    return data;
  } catch {
    return {
      activeJobs: 10_000,
      hiringCompanies: 5_000,
      registeredJobSeekers: 50_000,
      satisfactionRate: 98,
    };
  }
}

/** Apply to a job posting. */
export async function applyToJob(
  jobId: string,
  payload: Omit<CreateApplicationDto, 'jobId'>,
): Promise<{ applicationId: string }> {
  const { data } = await apiClient.post<{ applicationId: string }>(
    `/jobs/${jobId}/apply`,
    { ...payload, jobId },
  );
  return data;
}
