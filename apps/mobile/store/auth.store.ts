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
import { clearTokens, ACCESS_TOKEN_KEY, apiClient } from '../api/client';
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

      const user = await fetchMe();
      set({ user: user ?? null, status: user ? 'authenticated' : 'unauthenticated' });
    } catch {
      // Network failure or server error — don't wipe tokens.
      // Let the user proceed as unauthenticated; the 401 interceptor
      // will attempt token refresh on the next API call.
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

      set({ user: result as AuthUser, status: 'authenticated', error: null });
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
