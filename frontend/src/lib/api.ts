import { API_URL, clearAuth, getToken, refreshSession } from './auth';

/** An API refusal, with the server's own message. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Fired when the session can't be renewed; the shell sends the admin to sign in. */
export const SIGNED_OUT_EVENT = 'beleqet-admin-signed-out';

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** Calls the API with the admin's token, renewing it once on 401. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const request: RequestInit = {
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  };
  let response = await send(path, request, getToken());
  if (response.status === 401) {
    const renewed = await refreshSession();
    if (!renewed) {
      clearAuth();
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
      throw new ApiError(401, 'Your session has ended. Sign in again.');
    }
    response = await send(path, request, renewed);
  }
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    const message = (data as { message?: string | string[] } | null)?.message;
    throw new ApiError(response.status, Array.isArray(message) ? message.join(', ') : message || `Request failed (${response.status})`);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Downloads a file (CSV export) with the admin's token. */
export async function download(path: string, filename: string): Promise<void> {
  let response = await send(path, {}, getToken());
  if (response.status === 401) response = await send(path, {}, await refreshSession());
  if (!response.ok) throw new ApiError(response.status, `Download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

/** Builds a query string, leaving out empty values. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
