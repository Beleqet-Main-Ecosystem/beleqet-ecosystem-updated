/**
 * Axios client with automatic JWT access-token injection and silent refresh.
 *
 * Token lifecycle:
 *  - accessToken  – short-lived, sent as Bearer header on every request
 *  - refreshToken – long-lived, stored in SecureStore, used once on 401
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'beleqet_access_token';
export const REFRESH_TOKEN_KEY = 'beleqet_refresh_token';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

/** Shared Axios instance used by all API modules. */
export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: silent refresh on 401 ───────────────────────────────

let isRefreshing = false;
// Queue of resolve/reject callbacks waiting for the refreshed token
type Resolver = (token: string | null) => void;
const refreshQueue: Resolver[] = [];

function drainQueue(token: string | null) {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue.length = 0;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // Another request is already refreshing — wait for it
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (!token) return reject(error);
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken,
      });

      const newAccess: string = data.accessToken;
      const newRefresh: string | undefined = data.refreshToken;

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccess);
      if (newRefresh) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefresh);
      }

      drainQueue(newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch {
      drainQueue(null);
      // Tokens invalid — clear storage and let the auth store log the user out
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

/** Persist tokens after a successful login / register / refresh. */
export async function persistTokens(access: string, refresh?: string | null) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

/** Remove all stored tokens (logout). */
export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
