/**
 * Freelance: projects, bids, contracts, milestones, escrow and the freelancer wallet. Shapes and
 * calls match the website (lib/api.ts, features/freelance/*, dashboard Wallet).
 */
import { get, send } from '../lib/api';
import { toPage, type Page } from './jobs';

// ── Projects ───────────────────────────────────────────────────────────────────

export type Gig = {
  id: string;
  title: string;
  categoryLabel: string;
  categorySlug: string;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  pricingType: 'FIXED' | 'HOURLY' | string;
  bidCount: number;
  skills: string[];
  description: string;
  deadlineDays: number | null;
  featured: boolean;
  /** Status FUNDED: the client's money is already in escrow. */
  funded: boolean;
  createdAt: string | null;
  clientName: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGig(raw: any): Gig {
  return {
    id: raw.id,
    title: raw.title ?? '',
    categoryLabel: raw.category?.label ?? '',
    categorySlug: raw.category?.slug ?? '',
    budgetMin: raw.budgetMin ?? 0,
    budgetMax: raw.budgetMax ?? 0,
    currency: raw.currency ?? 'ETB',
    pricingType: raw.pricingType ?? 'FIXED',
    bidCount: raw._count?.bids ?? 0,
    skills: raw.skills ?? [],
    description: raw.description ?? '',
    deadlineDays: raw.deadlineDays ?? null,
    featured: Boolean(raw.featured),
    funded: raw.status === 'FUNDED',
    createdAt: raw.createdAt ?? null,
    clientName: raw.clientName ?? null,
  };
}

export type GigDetail = Gig & {
  clientId: string;
  clientName: string;
  experienceLevel: string | null;
  locationPreference: string | null;
  attachments: string[];
  /** Still taking bids. */
  open: boolean;
  status: string;
  clientMemberSince: string | null;
  clientCompletedContracts: number;
};

export type GigSearch = {
  q?: string;
  category?: string;
  pricingType?: string;
  experienceLevel?: string;
  /** One of GIG_BUDGETS. */
  budget?: string;
  sort?: 'newest' | 'budget_high' | 'budget_low';
  page?: number;
  limit?: number;
};

/** Budget ranges in ETB, the same as the website's project filters. */
export const GIG_BUDGETS: Record<string, { min?: number; max?: number }> = {
  under5k: { max: 5000 },
  '5k-20k': { min: 5000, max: 20000 },
  '20k-50k': { min: 20000, max: 50000 },
  over50k: { min: 50000 },
};

export async function searchGigs(search: GigSearch): Promise<Page<Gig>> {
  const limit = search.limit ?? 20;
  const data = await get('/freelance/jobs', {
    q: search.q || undefined,
    category: search.category || undefined,
    pricingType: search.pricingType || undefined,
    experienceLevel: search.experienceLevel || undefined,
    budgetMin: search.budget ? GIG_BUDGETS[search.budget]?.min : undefined,
    budgetMax: search.budget ? GIG_BUDGETS[search.budget]?.max : undefined,
    sort: search.sort && search.sort !== 'newest' ? search.sort : undefined,
    page: search.page ?? 1,
    limit,
  });
  return toPage(data, toGig, search.page ?? 1, limit);
}

export async function fetchGig(id: string): Promise<GigDetail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await get<any>(`/freelance/jobs/${encodeURIComponent(id)}`);
  const first = raw.client?.firstName ?? '';
  const last = raw.client?.lastName ?? '';
  return {
    ...toGig(raw),
    clientId: raw.clientId,
    clientName: `${first} ${last ? `${last.charAt(0)}.` : ''}`.trim(),
    experienceLevel: raw.experienceLevel ?? null,
    locationPreference: raw.locationPreference ?? null,
    attachments: raw.attachments ?? [],
    status: raw.status ?? '',
    clientMemberSince: raw.client?.memberSince ?? null,
    clientCompletedContracts: raw.client?.completedContracts ?? 0,
    open: raw.status === 'OPEN' || raw.status === 'FUNDED',
  };
}

export type GigCategory = { id: string; slug: string; label: string };

/** Freelance categories, without the rows test runs leave behind. */
export async function fetchGigCategories(): Promise<GigCategory[]> {
  const data = await get<GigCategory[]>('/freelance/categories');
  return Array.isArray(data) ? data.filter((c) => !c.slug.startsWith('gdpr-test')) : [];
}

export async function fetchSavedGigIds(): Promise<string[]> {
  const rows = await get<{ id: string }[]>('/freelance/saved');
  return (rows ?? []).map((row) => row.id);
}

/** Saved projects, newest saved first, as full project cards. */
export async function fetchSavedGigs(): Promise<Gig[]> {
  const rows = await get<unknown[]>('/freelance/saved');
  return (rows ?? []).map(toGig);
}

export const saveGig = (id: string) => send('POST', `/freelance/jobs/${encodeURIComponent(id)}/save`);
export const unsaveGig = (id: string) => send('DELETE', `/freelance/jobs/${encodeURIComponent(id)}/save`);

export type NewGig = {
  title: string;
  description: string;
  categoryId: string;
  budgetMin: number;
  budgetMax: number;
  pricingType: 'FIXED' | 'HOURLY';
  deadlineDays: number;
  skills: string[];
  experienceLevel: string;
  locationPreference?: string;
  attachments: string[];
};

export const createGig = (gig: NewGig) => send<{ id: string }>('POST', '/freelance/jobs', gig);

// ── Bids ───────────────────────────────────────────────────────────────────────

export type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export type GigBid = {
  id: string;
  amount: number;
  timelineDays: number;
  coverLetter: string;
  status: BidStatus;
  createdAt?: string;
  freelancer: { id: string; firstName: string; lastName: string; memberSince?: string; completedContracts?: number; portfolioUrl?: string | null };
};

/** The owner gets every bid, anyone else only their own. */
export const fetchGigBids = (gigId: string) => get<GigBid[]>(`/freelance/jobs/${encodeURIComponent(gigId)}/bids`);
export const submitBid = (gigId: string, bid: { amount: number; timelineDays: number; coverLetter: string }) =>
  send<GigBid>('POST', `/freelance/jobs/${encodeURIComponent(gigId)}/bids`, bid);
/** Accepting creates the contract, and the response is that contract. */
export const acceptBid = (bidId: string) => send<{ id: string }>('PATCH', `/freelance/bids/${encodeURIComponent(bidId)}/accept`);
export const rejectBid = (bidId: string) => send('PATCH', `/freelance/bids/${encodeURIComponent(bidId)}/reject`);

export type MyBid = { id: string; amount: number; status: BidStatus; createdAt: string; freelanceJob: { id: string; title: string; currency?: string; contract?: { id: string } | null } };
export const fetchMyBids = () => get<MyBid[]>('/freelance/my-bids');

// ── Contracts ──────────────────────────────────────────────────────────────────

export type Deliverable = { id: string; fileUrl?: string | null; notes?: string | null; submittedAt: string };
export type MilestoneStatus = 'PROPOSED' | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED';
export type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  deadline: string;
  status: MilestoneStatus;
  approvedAt?: string | null;
  revisionNote?: string | null;
  revisionRequestedAt?: string | null;
  deliverables?: Deliverable[];
};
type Party = { id: string; firstName: string; lastName: string };
export type ContractStatus = 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
export type ContractEvent = { type: string; at: string; milestone: string | null; note: string | null };
export type Contract = {
  id: string;
  freelanceJobId: string;
  clientId: string;
  freelancerId: string;
  agreedAmount: number;
  currency: string;
  status: ContractStatus;
  startedAt: string;
  freelanceJob: { title: string; escrowTx?: { status: string; grossAmount: number; fundedAt?: string | null } | null };
  client: Party;
  freelancer: Party;
  milestones: Milestone[];
  activity?: ContractEvent[];
};

export const fetchContract = (id: string) => get<Contract>(`/freelance/contracts/${encodeURIComponent(id)}`);

export type MyContract = { id: string; freelanceJobId: string; agreedAmount: number; currency: string; status: ContractStatus; startedAt: string; clientId: string; freelanceJob: { title: string }; client?: Party; freelancer?: Party };
export const fetchMyContracts = () => get<MyContract[]>('/freelance/my-contracts');

/** The contract for a project, if the viewer is one of its two parties. */
export async function findContractId(gigId: string): Promise<string | null> {
  const contracts = await fetchMyContracts();
  return contracts.find((contract) => contract.freelanceJobId === gigId)?.id ?? null;
}

export const fundEscrow = (gigId: string) => send<{ checkoutUrl?: string | null; amountToPay?: number }>('POST', `/escrow/initiate/${encodeURIComponent(gigId)}`);
export const addMilestone = (contractId: string, milestone: { title: string; amount: number; deadline: string; description?: string }) =>
  send<Milestone>('POST', `/freelance/contracts/${encodeURIComponent(contractId)}/milestones`, milestone);
export const acceptMilestone = (id: string) => send('PATCH', `/freelance/milestones/${encodeURIComponent(id)}/accept`);
export const declineMilestone = (id: string) => send('DELETE', `/freelance/milestones/${encodeURIComponent(id)}`);
export const releaseMilestone = (id: string) => send('PATCH', `/freelance/milestones/${encodeURIComponent(id)}/approve`);
export const requestRevision = (id: string, reason: string) => send('PATCH', `/freelance/milestones/${encodeURIComponent(id)}/request-revision`, { reason });
export const submitWork = (id: string, work: { fileUrl?: string; notes: string }) => send('POST', `/freelance/milestones/${encodeURIComponent(id)}/deliverables`, work);
export const raiseDispute = (contractId: string, reason: string) => send('POST', `/freelance/contracts/${encodeURIComponent(contractId)}/dispute`, { reason });

// ── Employer: their projects ───────────────────────────────────────────────────

export type MyProject = { id: string; title: string; status: string; budgetMin: number; budgetMax: number; currency: string; createdAt: string; contract: { id: string; status: string } | null; _count: { bids: number } };
export const fetchMyProjects = () => get<MyProject[]>('/freelance/my-projects');

// ── Wallet ─────────────────────────────────────────────────────────────────────

export type WalletTx = { id: string; type: string; amount: number; note: string | null; createdAt: string };
export type WalletData = { availableBalance: number; pendingBalance: number; currency: string; transactions: WalletTx[] };
export type Bank = { code: string; name: string; accountLength: number | null; mobileMoney: boolean };

export const fetchWallet = () => get<WalletData>('/wallet');
export const fetchBanks = () => get<Bank[]>('/wallet/banks');
export const withdraw = (input: { amount: number; bankCode: string; accountName: string; accountNumber: string }, stepUpToken?: string) =>
  send('POST', '/wallet/withdraw', { ...input, currency: 'ETB' }, stepUpToken ? { 'x-step-up-token': stepUpToken } : undefined);

/** A withdrawal's state lives in its note: sent, failed (money returned) or still processing. */
export function withdrawalState(note: string | null): 'sent' | 'failed' | 'processing' {
  if (!note) return 'processing';
  if (/WITHDRAWAL_SUBMITTED|transfer submitted/i.test(note)) return 'sent';
  if (/WITHDRAWAL_FAILED|Withdrawal FAILED/i.test(note)) return 'failed';
  return 'processing';
}

/** Trades a 6-digit two-step code for a short-lived pass for one sensitive action. */
export async function stepUp(action: string, code: string): Promise<string> {
  const { stepUpToken } = await send<{ stepUpToken: string }>('POST', '/auth/2fa/challenge', { action });
  const verified = await send<{ stepUpToken: string }>('POST', '/auth/2fa/step-up', { stepUpToken, code, action });
  return verified.stepUpToken;
}
