'use client';

import { useEffect } from 'react';
import { loadAuthToken } from '@/lib/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    loadAuthToken();
  }, []);

  return <>{children}</>;
}
