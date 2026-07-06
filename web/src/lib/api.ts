import type { FraudAlert, FraudRule, PaginatedResponse } from '@/types/fraud';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let authToken: string | undefined;

export function setAuthToken(token: string | undefined): void {
  authToken = token;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }
  return res.json() as Promise<T>;
}

export function getFraudAlerts(params?: {
  status?: string;
  severity?: string;
  ruleType?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<FraudAlert>> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.severity) sp.set('severity', params.severity);
  if (params?.ruleType) sp.set('ruleType', params.ruleType);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return fetchApi<PaginatedResponse<FraudAlert>>(`/admin/fraud/alerts${qs ? `?${qs}` : ''}`);
}

export function getFraudAlert(id: string): Promise<{ alert: FraudAlert; context: Record<string, unknown> }> {
  return fetchApi(`/admin/fraud/alerts/${id}`);
}

export function resolveFraudAlert(
  id: string,
  data: { status: string; resolutionNote?: string },
): Promise<{ resolved: boolean; alert: FraudAlert }> {
  return fetchApi(`/admin/fraud/alerts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getFraudRules(): Promise<FraudRule[]> {
  return fetchApi<FraudRule[]>('/admin/fraud/rules');
}

export function createFraudRule(data: Partial<FraudRule> & { name: string; ruleType: string; i18nKey: string }): Promise<FraudRule> {
  return fetchApi('/admin/fraud/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateFraudRule(id: string, data: Partial<FraudRule>): Promise<FraudRule> {
  return fetchApi(`/admin/fraud/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
