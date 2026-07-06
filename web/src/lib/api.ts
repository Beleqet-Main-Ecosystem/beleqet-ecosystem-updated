import type { FraudAlert, FraudRule, PaginatedResponse } from '@/types/fraud';

const API_BASE =
  typeof window !== 'undefined'
    ? '/api/v1'
    : process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1`
      : 'http://localhost:4000/api/v1';

const TOKEN_KEY = 'beleqet_admin_token';

let authToken: string | undefined;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function parseErrorMessage(body: string, status: number): string {
  if (status === 403) return 'You do not have permission to access this resource.';
  try {
    const parsed = JSON.parse(body) as { message?: string | string[] };
    if (typeof parsed.message === 'string') return parsed.message;
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
  } catch {
    /* plain text body */
  }
  return body || `Request failed (${status})`;
}

export function setAuthToken(token: string | undefined): void {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
}

export function loadAuthToken(): string | undefined {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem(TOKEN_KEY) ?? undefined;
  }
  return authToken;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, parseErrorMessage(body, res.status));
  }
  const data = (await res.json()) as { accessToken: string; user: { role: string } };
  if (data.user.role !== 'ADMIN') throw new Error('Admin role required');
  setAuthToken(data.accessToken);
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  const token = authToken ?? loadAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.text();
    if (res.status === 401) setAuthToken(undefined);
    const message =
      res.status === 401
        ? 'Your session has expired. Please sign in again.'
        : parseErrorMessage(errorBody, res.status);
    throw new ApiError(res.status, message);
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
