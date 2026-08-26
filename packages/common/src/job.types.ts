/**
 * Job listing DTOs and response types.
 * Field names match the Prisma `Job` and `JobCategory` models.
 */

import { JobType, JobStatus } from './enums';

// ── Sub-types ─────────────────────────────────────────────────────────────────

export interface JobCategory {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
}

export interface JobCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  industry?: string | null;
  verified?: boolean;
}

// ── Main types ────────────────────────────────────────────────────────────────

/** Full job listing as returned by `GET /jobs/:id`. */
export interface Job {
  id: string;
  title: string;
  description: string;
  requirements?: string | null;
  location: string;
  type: JobType;
  categoryId: string;
  category?: JobCategory | null;
  companyId: string;
  company?: JobCompany | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  /** ISO date string. */
  deadline?: string | null;
  status: JobStatus;
  featured: boolean;
  urgent: boolean;
  tags?: string[];
  experienceLevel?: string | null;
  yearsOfExperience?: string | null;
  qualification?: string | null;
  salaryType?: string | null;
  vacancies?: number | null;
  applyType?: string | null;
  applyUrl?: string | null;
  applyEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Paginated jobs list response from `GET /jobs`. */
export interface JobsResponse {
  items: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Platform-wide stats from `GET /jobs/stats`. */
export interface JobStats {
  activeJobs: number;
  hiringCompanies: number;
  registeredJobSeekers: number;
  satisfactionRate: number;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface QueryJobsDto {
  q?: string;
  category?: string;
  location?: string;
  type?: JobType;
  status?: JobStatus;
  page?: number;
  limit?: number;
  featured?: boolean;
}

export interface CreateJobDto {
  title: string;
  description: string;
  requirements?: string;
  location: string;
  type: JobType;
  categoryId: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  deadline?: string;
  featured?: boolean;
  urgent?: boolean;
  tags?: string[];
  experienceLevel?: string;
  yearsOfExperience?: string;
  qualification?: string;
  salaryType?: string;
  vacancies?: number;
  applyType?: string;
  applyUrl?: string;
  applyEmail?: string;
  status?: JobStatus;
}
