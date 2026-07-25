/**
 * Centralised API service functions.
 * All backend communication is handled here - not inside components (DRY principle).
 */
import apiClient from './apiClient';
import type {
  AuditLog,
  AuditLogListResponse,
  AuditLogQuery,
  AuthResponse,
  Dispute,
  PlatformStats,
} from '@/types';

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

/** Fetches paginated audit logs for the admin Log Viewer */
export async function fetchAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogListResponse> {
  const { data } = await apiClient.get<AuditLogListResponse>('/admin/audit-logs', {
    params: {
      lang: 'en',
      currency: 'ETB',
      page: 1,
      limit: 20,
      ...query,
    },
  });
  return data;
}

/** Fetches a single audit log by id */
export async function fetchAuditLogById(
  id: string,
  currency: string = 'ETB',
  lang: string = 'en',
): Promise<AuditLog> {
  const { data } = await apiClient.get<AuditLog>(`/admin/audit-logs/${id}`, {
    params: { currency, lang },
  });
  return data;
}

/** Downloads filtered audit logs as a browser attachment (JSON or CSV) */
export async function exportAuditLogs(
  query: AuditLogQuery & { format?: 'json' | 'csv' } = {},
): Promise<void> {
  const response = await apiClient.get<Blob>('/admin/audit-logs/export', {
    params: { lang: 'en', currency: 'ETB', format: 'json', ...query },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `audit-logs.${query.format || 'json'}`;
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
