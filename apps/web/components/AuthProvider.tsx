'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser, clearAuth, enforceKeepSignedIn, getStoredUser, SESSION_ENDED_EVENT, signInWithTelegram } from '@/lib/auth';
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
    // Opened from a Telegram bot: sign in with Telegram, so bot users never need a password.
    // Someone who hasn't registered in the bot browses as a guest.
    const signInWithTelegramLaunch = () =>
      loadTelegramWebApp()
        .then(async (webApp) => {
          if (!webApp) return;
          const result = await signInWithTelegram(webApp.initData);
          if (result.status === 'signed-in') setUser(result.user);
        })
        .catch(() => undefined); // Falls back to the normal sign-in page.

    enforceKeepSignedIn();
    const stored = getStoredUser();
    setUser(stored);

    // A session the server stopped accepting: drop it, and inside Telegram sign in again.
    const ended = () => {
      setUser(null);
      if (isTelegramLaunch()) void signInWithTelegramLaunch();
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);

    if (stored || !isTelegramLaunch()) {
      setReady(true);
    } else {
      // Pages wait (ready stays false) so they don't flash "Sign in" first.
      void signInWithTelegramLaunch().finally(() => setReady(true));
    }
    return () => window.removeEventListener(SESSION_ENDED_EVENT, ended);
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
