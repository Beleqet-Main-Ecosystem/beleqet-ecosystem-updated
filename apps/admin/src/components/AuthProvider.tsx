'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type AdminUser, getStoredUser, logout } from '@/lib/auth';
import { SIGNED_OUT_EVENT } from '@/lib/api';

type Auth = { user: AdminUser | null; ready: boolean; setUser: (user: AdminUser | null) => void; signOut: () => Promise<void> };
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
    const onSignedOut = () => setUser(null);
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, setUser, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
