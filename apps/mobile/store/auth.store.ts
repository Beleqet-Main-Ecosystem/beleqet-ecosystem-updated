/**
 * Global auth state managed by Zustand.
 *
 * Responsibilities:
 *  - Hold the current user + auth status
 *  - Expose login / register / logout / hydrate actions
 *  - Trigger token clearance via the API client layer
 */

import { create } from 'zustand';
import type { AuthUser, LoginInput, RegisterInput } from '../api/auth';
import { loginUser, registerUser, fetchMe } from '../api/auth';
import { clearTokens } from '../api/client';

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
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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
      const user = await fetchMe();
      set({ user: user ?? null, status: user ? 'authenticated' : 'unauthenticated' });
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (input) => {
    set({ status: 'loading', error: null });
    try {
      const user = await loginUser(input);
      set({ user, status: 'authenticated', error: null });
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
    await clearTokens();
    set({ user: null, status: 'unauthenticated', error: null });
  },

  clearError: () => set({ error: null }),

  setUser: (user) => set({ user }),
}));
