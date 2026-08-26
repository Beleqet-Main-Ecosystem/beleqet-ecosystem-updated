/**
 * Job application DTOs and response types.
 * Field names match the Prisma `Application` model.
 */

import { ApplicationStatus } from './enums';

// ── Main types ────────────────────────────────────────────────────────────────

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  coverLetter?: string | null;
  resumeUrl?: string | null;
  portfolioUrl?: string | null;
  expectedSalary?: number | null;
  screeningAnswers?: Record<string, unknown> | null;
  status: ApplicationStatus;
  interviewSlot?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Paginated applications response from `GET /applications/my`. */
export interface ApplicationsResponse {
  items: Application[];
  total: number;
  page: number;
  limit: number;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateApplicationDto {
  jobId: string;
  coverLetter?: string;
  resumeUrl?: string;
  portfolioUrl?: string;
  expectedSalary?: number;
  screeningAnswers?: Record<string, unknown>;
}

export interface UpdateApplicationStatusDto {
  status: ApplicationStatus;
}
