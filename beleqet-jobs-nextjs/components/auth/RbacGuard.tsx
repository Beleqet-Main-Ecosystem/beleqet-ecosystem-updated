'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserRole {
  name: string;
  permissions: { action: string }[];
}

interface RbacGuardProps {
  children: React.ReactNode;
  requiredPermissions: string[];
  fallback?: React.ReactNode;
}

/**
 * A client-side component to restrict access based on RBAC permissions.
 * It assumes a global state or context (mocked here) provides the current user's roles.
 */
export default function RbacGuard({ children, requiredPermissions, fallback }: RbacGuardProps) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // In a real implementation, this would fetch from a React Context or state management (e.g., Redux, Zustand)
    // For demonstration, we mock the user having some roles.
    const mockUserRoles: UserRole[] = [
      {
        name: 'ADMIN',
        permissions: [{ action: 'manage:roles' }, { action: 'manage:users' }],
      },
    ];

    const userPermissions = new Set<string>();
    mockUserRoles.forEach((role) => {
      role.permissions.forEach((permission) => userPermissions.add(permission.action));
    });

    const isAuthorized = requiredPermissions.every((permission) => userPermissions.has(permission));
    setHasAccess(isAuthorized);

    if (!isAuthorized && fallback === undefined) {
      router.push('/login');
    }
  }, [requiredPermissions, router, fallback]);

  if (hasAccess === null) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
