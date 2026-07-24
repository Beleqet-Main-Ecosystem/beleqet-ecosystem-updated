/**
 * Centralised API service functions.
 * All backend communication is handled here - not inside components (DRY principle).
 */
import apiClient from './apiClient';
import type { AuthResponse, Dispute, PlatformStats } from '@/types';

/** Logs in a user and stores the JWT token in localStorage */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  const token = data.access_token || data.accessToken;

  if (typeof window !== 'undefined') {
    if (!token) {
      throw new Error('Authentication response did not return an access token.');
    }
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
  return data;
}

/** Logs out the current user by informing the backend and clearing stored tokens */
export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Even if backend logout fails, clear local session data locally.
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }
}

/** Fetches aggregated platform stats from the admin-stats endpoint */
export async function fetchDashboardStats(
  currency: string = 'ETB',
  lang: string = 'en',
): Promise<PlatformStats> {
  const { data } = await apiClient.get<PlatformStats>('/admin-stats/dashboard', {
    params: { currency, lang },
  });
  return data;
}

/** Fetches all disputes (Admin-only) */
export async function fetchAllDisputes(): Promise<Dispute[]> {
  const { data } = await apiClient.get<Dispute[]>('/dispute');
  return data;
}

/** Resolves a dispute by ID (Admin-only) */
export async function resolveDispute(
  id: string,
  resolution: string,
  refundAmount?: number,
): Promise<{ message: string; dispute: Dispute }> {
  const { data } = await apiClient.patch<{ message: string; dispute: Dispute }>(
    `/dispute/${id}/resolve`,
    { resolution, refundAmount },
  );
  return data;
}

/** Creates a new dispute (Freelancer / Employer) */
export async function createDispute(
  contractId: string,
  reason: string,
  evidenceUrls: string[],
): Promise<Dispute> {
  const { data } = await apiClient.post<Dispute>('/dispute', {
    contractId,
    reason,
    evidenceUrls,
  });
  return data;
}

export type EscrowInitiationResult = {
  escrowId: string;
  checkoutUrl?: string | null;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  walletAppliedAmount: number;
  amountToPay?: number;
};

export type MilestoneConfirmationResult = {
  success: boolean;
  released: boolean;
  waitingFor?: 'EMPLOYER' | 'FREELANCER';
  alreadyReleased?: boolean;
};

export async function initiateEscrow(gigId: string): Promise<EscrowInitiationResult> {
  const { data } = await apiClient.post<EscrowInitiationResult>(`/escrow/initiate/${gigId}`);
  return data;
}

export async function confirmEscrowMilestone(
  milestoneId: string,
  note?: string,
): Promise<MilestoneConfirmationResult> {
  const { data } = await apiClient.post<MilestoneConfirmationResult>(
    `/escrow/milestones/${milestoneId}/confirm`,
    note ? { note } : {},
  );
  return data;
}

export async function enqueueChapaCallback(
  payload: Record<string, unknown>,
): Promise<{ success?: boolean; queued?: boolean; eventKey?: string }> {
  const { data } = await apiClient.post<{ success?: boolean; queued?: boolean; eventKey?: string }>(
    '/escrow/callback',
    payload,
  );
  return data;
}
