/**
 * The signed-in user, shared by every screen. Tokens live in SecureStore (api/client.ts); the
 * user record is cached there too so the app opens signed in while offline.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { ACCESS_TOKEN_KEY, USER_CACHE_KEY, clearTokens } from '../api/client';
import { fetchMe, serverLogout, type Me } from '../api/auth';
import { toApiError } from '../lib/api-error';

type Status = 'loading' | 'signed-in' | 'signed-out';

type AuthState = {
  user: Me | null;
  status: Status;
  /** Reads the saved session on launch, then refreshes the user in the background. */
  hydrate: () => Promise<void>;
  /** After any successful sign-in. */
  signedIn: (user: Me) => Promise<void>;
  /** Re-reads the user, e.g. after editing the profile or confirming the email. */
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

async function cache(user: Me | null) {
  if (user) await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(user)).catch(() => undefined);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null);
    if (!token) {
      set({ user: null, status: 'signed-out' });
      return;
    }
    try {
      const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
      if (raw) set({ user: JSON.parse(raw) as Me, status: 'signed-in' });
    } catch {
      // A broken cache just means we wait for the network.
    }
    try {
      const user = await fetchMe();
      await cache(user);
      set({ user, status: 'signed-in' });
    } catch (error) {
      const failure = toApiError(error);
      if (failure.status === 401 || failure.status === 403) {
        await clearTokens();
        set({ user: null, status: 'signed-out' });
      } else if (!get().user) {
        // Offline with no cached user: let them in signed-out; the session stays saved.
        set({ status: 'signed-out' });
      }
    }
  },

  signedIn: async (user) => {
    await cache(user);
    set({ user, status: 'signed-in' });
  },

  refreshUser: async () => {
    try {
      const user = await fetchMe();
      await cache(user);
      set({ user });
    } catch {
      // Keep what we have.
    }
  },

  signOut: async () => {
    await serverLogout();
    await clearTokens();
    set({ user: null, status: 'signed-out' });
  },
}));

export type Role = 'JOB_SEEKER' | 'FREELANCER' | 'EMPLOYER' | 'ADMIN';

/** Employers (and admins) hire; everyone else looks for work. */
export function isEmployer(user: Me | null | undefined): boolean {
  return user?.role === 'EMPLOYER' || user?.role === 'ADMIN';
}
