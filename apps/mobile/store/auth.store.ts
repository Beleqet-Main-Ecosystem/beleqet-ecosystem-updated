/**
 * Global auth state managed by Zustand.
 *
 * Responsibilities:
 *  - Hold the current user + auth status
 *  - Expose login / register / logout / hydrate actions
 *  - Trigger token clearance via the API client layer
 */

import { create } from 'zustand';
import type { AuthUser, LoginDto, RegisterDto } from '../api/auth';
import { loginUser, registerUser, fetchMe, type TwoFactorRequired } from '../api/auth';
import { clearTokens, ACCESS_TOKEN_KEY, USER_CACHE_KEY, apiClient } from '../api/client';
import * as SecureStore from 'expo-secure-store';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;

  /**
   * Re-hydrate auth state from SecureStore on app launch.
   * Calls GET /auth/me using the stored access token.
   */
  hydrate: () => Promise<void>;
  login: (input: LoginDto) => Promise<void>;
  register: (input: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  hydrate: async () => {
    set({ status: 'loading', error: null });
    try {
      // Check if we have stored tokens before making a network call
      const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (!storedToken) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }

      // Check if we have a locally cached user profile for instant offline display
      let cachedUser: AuthUser | null = null;
      try {
        const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
        if (raw) cachedUser = JSON.parse(raw) as AuthUser;
      } catch {
        // ignore parse error
      }

      if (cachedUser) {
        set({ user: cachedUser, status: 'authenticated' });
      }

      // Attempt background profile refresh
      try {
        const freshUser = await fetchMe();
        if (freshUser) {
          try {
            await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(freshUser));
          } catch {
            // ignore cache write error
          }
          set({ user: freshUser, status: 'authenticated' });
        } else if (!cachedUser) {
          set({ user: null, status: 'unauthenticated' });
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          await clearTokens();
          set({ user: null, status: 'unauthenticated' });
        } else if (cachedUser) {
          // Offline or network timeout — stay authenticated with cached profile!
          set({ user: cachedUser, status: 'authenticated' });
        } else {
          set({ user: null, status: 'unauthenticated' });
        }
      }
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const result = await loginUser(input);

      // Handle 2FA challenge — full 2FA screen to be built later
      if ('requires2fa' in result && result.requires2fa) {
        set({ status: 'unauthenticated', error: 'Two-factor authentication is required. Please use the web app to complete login.' });
        return;
      }

      const authUser = result as AuthUser;
      try {
        await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(authUser));
      } catch {
        // ignore cache write error
      }
      set({ user: authUser, status: 'authenticated', error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      set({ status: 'unauthenticated', error: msg });
      throw err;
    }
  },

  register: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const user = await registerUser(input);
      try {
        await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user));
      } catch {
        // ignore cache write error
      }
      set({ user, status: 'authenticated', error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      set({ status: 'unauthenticated', error: msg });
      throw err;
    }
  },

  logout: async () => {
    // Revoke refresh token server-side (fire-and-forget — don't block logout on network failure)
    try { await apiClient.post('/auth/logout'); } catch { /* best effort */ }
    await clearTokens();
    set({ user: null, status: 'unauthenticated', error: null });
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),
}));
