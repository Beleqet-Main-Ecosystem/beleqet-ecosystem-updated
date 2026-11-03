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
  const currency = gig.currency || 'ETB';
  const { budgetMin, budgetMax } = gig;
  if (budgetMin && budgetMax && budgetMin !== budgetMax)
    return `${budgetMin.toLocaleString()}–${budgetMax.toLocaleString()} ${currency}`;
  if (budgetMin) return `${budgetMin.toLocaleString()}+ ${currency}`;
  if (budgetMax) return `Up to ${budgetMax.toLocaleString()} ${currency}`;
  return `Negotiable (${currency})`;
}

export function gigPostedAgo(gig: FreelanceJob): string {
  return relativeTime(gig.createdAt);
}

// ── Offline fallback data ─────────────────────────────────────────────────────

export const FALLBACK_GIGS: FreelanceJob[] = [
  {
    id: 'f1',
    title: 'React Native Mobile App — Fintech MVP',
    description: 'Build a cross-platform fintech MVP in React Native with secure authentication, local state management, and real-time transaction history.',
    categoryId: 'web-development',
    clientId: 'fallback-client',
    budgetMin: 15_000,
    budgetMax: 30_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 30,
    skills: ['React Native', 'TypeScript', 'REST API', 'Tailwind'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: true,
    bidCount: 3,
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f2',
    title: 'Complete Brand Identity & Logo Package for Coffee Exporter',
    description: 'Create a premium corporate visual identity including logo mark, typography guidelines, packaging mockups, and business stationery.',
    categoryId: 'graphic-design',
    clientId: 'fallback-client',
    budgetMin: 8_000,
    budgetMax: 18_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 14,
    skills: ['Figma', 'Illustrator', 'Branding', 'Packaging'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: true,
    bidCount: 5,
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f3',
    title: 'English to Amharic Legal & Business Contract Translation',
    description: 'Accurate technical translation of commercial agreements, NDA contracts, and company bylaws from English to Amharic.',
    categoryId: 'writing',
    clientId: 'fallback-client',
    budgetMin: 5_000,
    budgetMax: 10_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 7,
    skills: ['Amharic', 'English', 'Legal Translation', 'Proofreading'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: true,
    bidCount: 4,
    createdAt: new Date(Date.now() - 12 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f4',
    title: 'Telegram Channel & TikTok Growth Specialist',
    description: 'Develop and execute an organic growth and engagement strategy for our Telegram announcement channel and official TikTok profile.',
    categoryId: 'digital-marketing',
    clientId: 'fallback-client',
    budgetMin: 7_500,
    budgetMax: 15_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 30,
    skills: ['Telegram Marketing', 'TikTok Ads', 'Content Strategy'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: true,
    bidCount: 2,
    createdAt: new Date(Date.now() - 18 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'f5',
    title: '60-Second 2D Animated Explainer Video with Voiceover',
    description: 'Produce a professional 60-second animated explainer video covering scriptwriting, custom character animation, and background music integration.',
    categoryId: 'video-animation',
    clientId: 'fallback-client',
    budgetMin: 14_000,
    budgetMax: 25_000,
    currency: 'ETB',
    pricingType: 'FIXED',
    deadlineDays: 10,
    skills: ['2D Animation', 'After Effects', 'Motion Graphics', 'Storyboarding'],
    status: 'OPEN' as FreelanceJob['status'],
    featured: true,
    bidCount: 6,
    createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── API functions ─────────────────────────────────────────────────────────────

/** Fetch paginated freelance gig listings. Falls back to static data only when offline. */
export async function fetchGigs(params: QueryFreelanceJobsDto = {}): Promise<FreelanceJob[]> {
  try {
    const { data } = await apiClient.get<FreelanceJobsResponse>('/freelance/jobs', {
      params: { limit: 40, status: 'OPEN', ...params },
    });
    // If the server responded with an items array, always return it (even if empty, so the UI can show empty state)
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return [];
  } catch {
    // Offline fallback — filter local mock data by category and search keyword if provided
    let fallback = FALLBACK_GIGS;
    if (params.category && params.category !== '__all__') {
      fallback = fallback.filter((g) => g.categoryId === params.category);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      fallback = fallback.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.skills.some((s) => s.toLowerCase().includes(q)),
      );
    }
    return fallback;
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
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    `/freelance/jobs/${gigId}/bids`,
    payload,
  );
  return data;
}
