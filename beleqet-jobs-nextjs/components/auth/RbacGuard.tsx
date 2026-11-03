'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

interface RbacGuardProps {
  children: React.ReactNode;
  /** What the page needs; only admins have these management permissions. */
  requiredPermissions: string[];
  fallback?: React.ReactNode;
}

/**
 * Shows admin-only pages to admins. It reads the signed-in user (it used to pretend every
 * visitor was an admin). The API checks permissions on every request; this only keeps admin
 * screens away from everyone else.
 */
export default function RbacGuard({ children, requiredPermissions, fallback }: RbacGuardProps) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const allowed = user?.role === 'ADMIN' || requiredPermissions.length === 0;

  useEffect(() => {
    if (ready && !allowed && !fallback) router.push(user ? '/' : `/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [ready, allowed, fallback, router, user]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-forest" />
      </div>
    );
  }
  if (!allowed) return fallback ? <>{fallback}</> : null;
  return <>{children}</>;
}
