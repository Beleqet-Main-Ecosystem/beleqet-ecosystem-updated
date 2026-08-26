/**
 * Freelance gig API — listings, detail, bids, contracts.
 * Types imported from @beleqet/common keep mobile aligned with the backend.
 */

import type {
  FreelanceJob,
  FreelanceJobsResponse,
  SubmitBidDto,
  QueryFreelanceJobsDto,
} from '@beleqet/common';
import { apiClient } from './client';

export type { FreelanceJob, QueryFreelanceJobsDto };

// ── Display helpers ───────────────────────────────────────────────────────────

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatBudget(gig: FreelanceJob): string {
  const { currency, budgetMin, budgetMax } = gig;
  if (budgetMin && budgetMax && budgetMin !== budgetMax)
    return `${budgetMin.toLocaleString()}–${budgetMax.toLocaleString()} ${currency}`;
  if (budgetMin) return `${budgetMin.toLocaleString()}+ ${currency}`;
  return currency;
}

export function gigPostedAgo(gig: FreelanceJob): string {
  return relativeTime(gig.createdAt);
}

// ── Static fallback data ──────────────────────────────────────────────────────

export const FALLBACK_GIGS: FreelanceJob[] = [
  {
    id: 'f1',
    title: 'React Native Mobile App — Fintech MVP',
    description: 'Build a cross-platform fintech MVP in React Native.',
    categoryId: 'web-app-dev',
    clientId: 'fallback-client',
    budgetMin: 12_000,
    budgetMax: 20_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 30,
    skills: ['React Native', 'TypeScript', 'REST API'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: false,
    bidCount: 3,
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f2',
    title: 'Logo & Brand Identity Kit',
    description: 'Full brand identity including logo, color palette, and typography.',
    categoryId: 'design-creative',
    clientId: 'fallback-client',
    budgetMin: 3_500,
    budgetMax: 6_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 14,
    skills: ['Illustrator', 'Branding', 'Figma'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: false,
    bidCount: 7,
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── API functions ─────────────────────────────────────────────────────────────

/** Fetch paginated freelance gig listings. Falls back to static data. */
export async function fetchGigs(params: QueryFreelanceJobsDto = {}): Promise<FreelanceJob[]> {
  try {
    const { data } = await apiClient.get<FreelanceJobsResponse>('/freelance/jobs', {
      params: { limit: 40, status: 'OPEN', ...params },
    });
    if (data.items && data.items.length > 0) return data.items;
    return FALLBACK_GIGS;
  } catch {
    return FALLBACK_GIGS;
  }
}

/** Fetch a single gig by ID. */
export async function fetchGig(id: string): Promise<FreelanceJob | null> {
  try {
    const { data } = await apiClient.get<FreelanceJob>(`/freelance/jobs/${id}`);
    return data;
  } catch {
    return FALLBACK_GIGS.find((g) => g.id === id) ?? null;
  }
}

/** Submit a bid/proposal for a gig. */
export async function submitProposal(
  gigId: string,
  payload: SubmitBidDto,
): Promise<{ proposalId: string }> {
  const { data } = await apiClient.post<{ proposalId: string }>(
    `/freelance/jobs/${gigId}/proposals`,
    payload,
  );
  return data;
}
