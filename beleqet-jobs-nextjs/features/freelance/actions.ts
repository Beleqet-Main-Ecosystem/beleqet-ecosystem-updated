import { authenticatedFetch } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

export type GigBid = {
  id: string;
  amount: number;
  timelineDays: number;
  coverLetter: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  freelancer: { id: string; firstName: string; lastName: string };
};

/** Fails with the HTTP status, so callers can tell "already bid" from a real error. */
export class ActionError extends Error {
  constructor(public status: number) {
    super(`Request failed: ${status}`);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new ActionError(response.status);
  return response.json();
}

/** Loaded only for signed-in viewers, so bids never end up in the public page. */
export async function fetchGigBids(gigId: string): Promise<GigBid[]> {
  const gig = await call<{ bids?: GigBid[] }>(`/freelance/jobs/${encodeURIComponent(gigId)}`);
  return gig.bids ?? [];
}

export function submitBid(gigId: string, bid: { amount: number; timelineDays: number; coverLetter: string }): Promise<GigBid> {
  return call(`/freelance/jobs/${encodeURIComponent(gigId)}/bids`, { method: 'POST', body: JSON.stringify(bid) });
}

/** Accepting creates the contract, and the response is that contract. */
export function acceptBid(bidId: string): Promise<{ id: string }> {
  return call(`/freelance/bids/${encodeURIComponent(bidId)}/accept`, { method: 'PATCH' });
}

export function rejectBid(bidId: string): Promise<GigBid> {
  return call(`/freelance/bids/${encodeURIComponent(bidId)}/reject`, { method: 'PATCH' });
}

export function createGig(gig: {
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
}): Promise<{ id: string }> {
  return call('/freelance/jobs', { method: 'POST', body: JSON.stringify(gig) });
}

export async function uploadAttachment(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('hasConsentedToProcessing', 'true');
  const response = await authenticatedFetch(`${API_URL}/uploads/file`, { method: 'POST', body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.publicUrl) throw new ActionError(response.status);
  return data.publicUrl;
}

export async function findContractId(gigId: string): Promise<string | null> {
  const contracts = await call<{ id: string; freelanceJobId: string }[]>('/freelance/my-contracts');
  return contracts.find((contract) => contract.freelanceJobId === gigId)?.id ?? null;
}
