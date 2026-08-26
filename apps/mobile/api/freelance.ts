/** Freelance gig API — listings, detail, escrow status. */

import { z } from 'zod';
import { apiClient } from './client';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const gigSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  budget: z.number().nullish(),
  budgetMin: z.number().nullish(),
  budgetMax: z.number().nullish(),
  currency: z.string().default('ETB'),
  type: z.enum(['FIXED', 'HOURLY', 'RETAINER']).nullish(),
  status: z.string().nullish(),
  categorySlug: z.string().nullish(),
  skills: z.array(z.string()).default([]),
  clientName: z.string().nullish(),
  createdAt: z.string().nullish(),
  escrowEnabled: z.boolean().default(false),
  rating: z.number().nullish(),
  proposalCount: z.number().nullish(),
  deadline: z.string().nullish(),
});

export type Gig = z.infer<typeof gigSchema>;

const gigsResponseSchema = z.object({
  items: z.array(gigSchema).default([]),
  total: z.number().nullish(),
});

// ── Static fallback data (used when API is unavailable) ───────────────────────

export const FALLBACK_GIGS: Gig[] = [
  {
    id: 'f1',
    title: 'React Native Mobile App — Fintech MVP',
    categorySlug: 'web-app-dev',
    budgetMin: 12_000,
    budgetMax: 20_000,
    budget: undefined,
    currency: 'ETB',
    type: 'FIXED',
    clientName: 'FinTech Startup',
    skills: ['React Native', 'TypeScript', 'REST API'],
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    escrowEnabled: true,
    rating: 4.9,
    status: 'OPEN',
    description: 'Build a cross-platform fintech MVP in React Native.',
    proposalCount: 3,
    deadline: null,
  },
  {
    id: 'f2',
    title: 'Logo & Brand Identity Kit',
    categorySlug: 'design-creative',
    budgetMin: 3_500,
    budgetMax: 6_000,
    budget: undefined,
    currency: 'ETB',
    type: 'FIXED',
    clientName: 'Boutique Roastery',
    skills: ['Illustrator', 'Branding', 'Figma'],
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    escrowEnabled: true,
    rating: 5.0,
    status: 'OPEN',
    description: 'Full brand identity including logo, color palette, and typography.',
    proposalCount: 7,
    deadline: null,
  },
  {
    id: 'f3',
    title: 'Amharic–English Document Translation',
    categorySlug: 'writing-translation',
    budgetMin: 2_000,
    budgetMax: 3_500,
    budget: undefined,
    currency: 'ETB',
    type: 'FIXED',
    clientName: 'NGO Ethiopia',
    skills: ['Amharic', 'English', 'Legal Text'],
    createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    escrowEnabled: true,
    rating: 4.8,
    status: 'OPEN',
    description: 'Translate 30-page legal document from Amharic to English.',
    proposalCount: 4,
    deadline: null,
  },
  {
    id: 'f4',
    title: 'Product Explainer Video (60s)',
    categorySlug: 'video-animation',
    budgetMin: 8_000,
    budgetMax: 14_000,
    budget: undefined,
    currency: 'ETB',
    type: 'FIXED',
    clientName: 'EdTech Company',
    skills: ['After Effects', 'Motion Design'],
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    escrowEnabled: true,
    rating: 4.7,
    status: 'OPEN',
    description: 'Animated explainer video for a new e-learning platform.',
    proposalCount: 2,
    deadline: null,
  },
  {
    id: 'f5',
    title: 'Monthly Bookkeeping & Reporting',
    categorySlug: 'finance-accounting',
    budgetMin: 3_000,
    budgetMax: 3_000,
    budget: 3_000,
    currency: 'ETB',
    type: 'RETAINER',
    clientName: 'Small Retailer',
    skills: ['QuickBooks', 'Excel', 'IFRS'],
    createdAt: new Date(Date.now() - 12 * 3_600_000).toISOString(),
    escrowEnabled: true,
    rating: 5.0,
    status: 'OPEN',
    description: 'Monthly bookkeeping, reconciliation, and financial reporting.',
    proposalCount: 1,
    deadline: null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso?: string | null): string {
  if (!iso) return 'Recently';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatBudget(gig: Gig): string {
  const { currency, budget, budgetMin, budgetMax } = gig;
  if (budget) return `${budget.toLocaleString()} ${currency}`;
  if (budgetMin && budgetMax)
    return `${budgetMin.toLocaleString()}–${budgetMax.toLocaleString()} ${currency}`;
  if (budgetMin) return `${budgetMin.toLocaleString()}+ ${currency}`;
  return `${currency}`;
}

export function gigPostedAgo(gig: Gig): string {
  return relativeTime(gig.createdAt);
}

// ── API functions ─────────────────────────────────────────────────────────────

export type GigsParams = {
  limit?: number;
  offset?: number;
  category?: string;
  q?: string;
  status?: string;
};

/**
 * Fetch paginated freelance gig listings.
 * Falls back to static FALLBACK_GIGS when the API is unreachable.
 */
export async function fetchGigs(params: GigsParams = {}): Promise<Gig[]> {
  try {
    const { data } = await apiClient.get('/freelance/jobs', {
      params: { limit: 40, status: 'OPEN', ...params },
    });
    const parsed = gigsResponseSchema.parse(data);
    if (parsed.items.length > 0) return parsed.items;
    return FALLBACK_GIGS;
  } catch {
    return FALLBACK_GIGS;
  }
}

/**
 * Fetch a single gig by ID.
 */
export async function fetchGig(id: string): Promise<Gig | null> {
  try {
    const { data } = await apiClient.get(`/freelance/jobs/${id}`);
    return gigSchema.parse(data);
  } catch {
    return FALLBACK_GIGS.find((g) => g.id === id) ?? null;
  }
}

/**
 * Submit a proposal for a gig.
 */
export async function submitProposal(
  gigId: string,
  payload: { coverLetter: string; proposedBudget: number },
): Promise<{ proposalId: string }> {
  const { data } = await apiClient.post(`/freelance/jobs/${gigId}/proposals`, payload);
  return data as { proposalId: string };
}
