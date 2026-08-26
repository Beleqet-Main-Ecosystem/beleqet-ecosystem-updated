/**
 * Freelance gig, bid, and contract DTOs and response types.
 * Field names match the Prisma `FreelanceJob`, `Bid`, and `Contract` models.
 */

import { FreelanceJobStatus, BidStatus, ContractStatus } from './enums';

// ── Sub-types ─────────────────────────────────────────────────────────────────

export interface FreelanceCategory {
  id: string;
  slug: string;
  label: string;
  icon?: string | null;
}

export interface FreelanceUserRef {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

// ── Gig / FreelanceJob ────────────────────────────────────────────────────────

/** Freelance gig as returned by `GET /freelance/jobs`. */
export interface FreelanceJob {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category?: FreelanceCategory | null;
  clientId: string;
  client?: FreelanceUserRef | null;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  pricingType: string;
  deadlineDays: number;
  skills: string[];
  status: FreelanceJobStatus;
  featured: boolean;
  experienceLevel?: string | null;
  locationPreference?: string | null;
  attachments?: string[];
  /** Number of bids — from `_count.bids`. */
  bidCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** Paginated freelance jobs list response from `GET /freelance/jobs`. */
export interface FreelanceJobsResponse {
  items: FreelanceJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Bid / Proposal ────────────────────────────────────────────────────────────

export interface Bid {
  id: string;
  freelanceJobId: string;
  freelancerId: string;
  freelancer?: FreelanceUserRef | null;
  amount: number;
  timelineDays: number;
  coverLetter: string;
  status: BidStatus;
  qualityScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Contract ──────────────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  freelanceJobId: string;
  clientId: string;
  freelancerId: string;
  client?: FreelanceUserRef | null;
  freelancer?: FreelanceUserRef | null;
  agreedAmount: number;
  currency: string;
  status: ContractStatus;
  startedAt: string;
  completedAt?: string | null;
  updatedAt: string;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateFreelanceJobDto {
  title: string;
  description: string;
  categoryId: string;
  budgetMin: number;
  budgetMax: number;
  currency?: string;
  pricingType?: string;
  deadlineDays: number;
  skills: string[];
  experienceLevel?: string;
  locationPreference?: string;
}

export interface SubmitBidDto {
  amount: number;
  timelineDays: number;
  coverLetter: string;
}

export interface QueryFreelanceJobsDto {
  q?: string;
  category?: string;
  status?: FreelanceJobStatus;
  page?: number;
  limit?: number;
}
