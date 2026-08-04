/**
 * Centralised API service functions.
 * All backend communication is handled here - not inside components (DRY principle).
 */
import apiClient from './apiClient';
import type {
  AuthResponse,
  Dispute,
  PlatformStats,
  OverviewResponse,
  RevenueChartResponse,
  UserGrowthChartResponse,
  ProjectBreakdownResponse,
  StatsQueryParams,
  AuditLogPage,
  AuditLogFilters,
  Notification,
  NotificationPreference,
  ThemePreference,
  ThemePreferenceResponse,
  PromotionCampaign,
  CampaignAnalytics,
} from '@/types';

/** Fetches the current authenticated user's persisted theme preference. */
export async function getThemePreference(): Promise<ThemePreferenceResponse> {
  const { data } = await apiClient.get<ThemePreferenceResponse>('/user-preferences/theme');
  return data;
}

/** Persists the selected theme for the current authenticated user. */
export async function updateThemePreference(
  theme: ThemePreference,
): Promise<ThemePreferenceResponse> {
  const { data } = await apiClient.patch<ThemePreferenceResponse>('/user-preferences/theme', {
    theme,
  });
  return data;
}

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

/** @deprecated Prefer fetchAdminOverview */
export async function fetchDashboardStats(
  currency: string = 'ETB',
  lang: string = 'en',
): Promise<PlatformStats> {
  const { data } = await apiClient.get<PlatformStats>('/admin-stats/dashboard', {
    params: { currency, lang },
  });
  return data;
}

/** Summary cards for the admin dashboard */
export async function fetchAdminOverview(params: StatsQueryParams = {}): Promise<OverviewResponse> {
  const { data } = await apiClient.get<OverviewResponse>('/admin-stats/overview', { params });
  return data;
}

/** Zero-filled revenue time series */
export async function fetchAdminRevenueChart(
  params: StatsQueryParams = {},
): Promise<RevenueChartResponse> {
  const { data } = await apiClient.get<RevenueChartResponse>('/admin-stats/charts/revenue', {
    params,
  });
  return data;
}

/** Zero-filled user growth time series */
export async function fetchAdminUserGrowthChart(
  params: StatsQueryParams = {},
): Promise<UserGrowthChartResponse> {
  const { data } = await apiClient.get<UserGrowthChartResponse>('/admin-stats/charts/users', {
    params,
  });
  return data;
}

/** Project status summary + recent projects table */
export async function fetchAdminProjectBreakdown(
  params: StatsQueryParams = {},
): Promise<ProjectBreakdownResponse> {
  const { data } = await apiClient.get<ProjectBreakdownResponse>('/admin-stats/projects/breakdown', {
    params,
  });
  return data;
}

/** Downloads a CSV export for an admin-stats resource. */
export async function downloadAdminStatsCsv(
  path: string,
  params: StatsQueryParams = {},
  filenameFallback = 'admin-stats.csv',
): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(path, {
    params,
    responseType: 'blob',
  });
  const disposition = String(headers['content-disposition'] || '');
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || filenameFallback;
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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

/** Fetches a paginated, filterable slice of the audit trail (Admin-only). */
export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const { data } = await apiClient.get<AuditLogPage>('/audit-logs', { params: filters });
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

// ── Notifications ──────────────────────────────────────────────────────────────

/** Fetch current user's notifications (latest 50, descending) */
export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<Notification[]>('/users/notifications');
  return data;
}

/** Mark a single notification as read */
export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/users/notifications/${id}/read`);
}

/** Mark all notifications as read */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/users/notifications/read-all');
}

/** Fetch current user's notification preferences */
export async function fetchNotificationPreferences(): Promise<NotificationPreference> {
  const { data } = await apiClient.get<NotificationPreference>('/users/notification-preferences');
  return data;
}

/** Update current user's notification preferences */
export async function updateNotificationPreferences(
  prefs: Partial<
    Pick<
      NotificationPreference,
      | 'emailEnabled'
      | 'telegramEnabled'
      | 'inAppEnabled'
      | 'pushEnabled'
      | 'smsEnabled'
      | 'language'
    >
  >,
): Promise<NotificationPreference> {
  const { data } = await apiClient.patch<NotificationPreference>(
    '/users/notification-preferences',
    prefs,
  );
  return data;
}
// ── Promoted Engine ──────────────────────────────────────────────────────────

/** Creates a new promotion campaign for a job, proposal, or gig. */
export async function createCampaign(payload: {
  targetType: 'JOB' | 'PROPOSAL' | 'GIG';
  targetId: string;
  cpcBid: number;
  dailyBudget: number;
  totalBudget?: number;
  currency?: string;
  endAt?: string;
}): Promise<PromotionCampaign> {
  const { data } = await apiClient.post<PromotionCampaign>('/promoted-engine/campaigns', payload);
  return data;
}

/** Lists the current user's own campaigns. */
export async function listMyCampaigns(): Promise<PromotionCampaign[]> {
  const { data } = await apiClient.get<PromotionCampaign[]>('/promoted-engine/campaigns/mine');
  return data;
}

/** Fetches a single campaign by id. */
export async function getCampaign(id: string): Promise<PromotionCampaign> {
  const { data } = await apiClient.get<PromotionCampaign>(`/promoted-engine/campaigns/${id}`);
  return data;
}

/** Pauses, resumes, or cancels a campaign. */
export async function updateCampaignStatus(
  id: string,
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED',
): Promise<PromotionCampaign> {
  const { data } = await apiClient.patch<PromotionCampaign>(`/promoted-engine/campaigns/${id}/status`, { status });
  return data;
}

/** Fetches impressions/clicks/conversions/spend for a single campaign. */
export async function getCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  const { data } = await apiClient.get<CampaignAnalytics>(`/promoted-engine/campaigns/${id}/analytics`);
  return data;
}

/** Checks which of a batch of targets currently have a winning active boost. No auth required. */
export async function getActiveBoosts(
  targetType: 'JOB' | 'PROPOSAL' | 'GIG',
  targetIds: string[],
): Promise<{ targetId: string; isBoosted: boolean }[]> {
  const { data } = await apiClient.get<{ targetId: string; isBoosted: boolean }[]>('/promoted-engine/active-boosts', {
    params: { targetType, targetIds: targetIds.join(',') },
  });
  return data;
}