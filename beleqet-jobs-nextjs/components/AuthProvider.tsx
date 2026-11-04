'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser, clearAuth, enforceKeepSignedIn, getStoredUser, signInWithTelegram } from '@/lib/auth';
import { isTelegramLaunch, loadTelegramWebApp } from '@/lib/telegram-webapp';

type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    enforceKeepSignedIn();
    const stored = getStoredUser();
    setUser(stored);
    if (stored || !isTelegramLaunch()) {
      setReady(true);
      return;
    }
    // Opened from a Telegram bot: sign in with Telegram, so bot users never need a password.
    // Pages wait (ready stays false) so they don't flash "Sign in" first.
    const role = /^\/(post-job|employer)/.test(window.location.pathname) ? 'EMPLOYER' : 'JOB_SEEKER';
    void loadTelegramWebApp()
      .then(async (webApp) => {
        if (!webApp) return;
        const result = await signInWithTelegram(webApp.initData, role);
        if (result.status === 'signed-in') setUser(result.user);
      })
      .catch(() => undefined) // Falls back to the normal sign-in page.
      .finally(() => setReady(true));
  }, []);

  function logout() {
    clearAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, setUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
