'use client';

import React, { useState, useEffect } from 'react';

// Mock types
type Permission = { id: string; action: string; description: string };
type Role = { id: string; name: string; isSystem: boolean; permissions: Permission[] };

export default function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock initial data fetch
  useEffect(() => {
    setTimeout(() => {
      setPermissions([
        { id: '1', action: 'manage:roles', description: 'Can manage roles and permissions' },
        { id: '2', action: 'create:jobs', description: 'Can post new jobs' },
        { id: '3', action: 'delete:users', description: 'Can delete user accounts' },
      ]);
      setRoles([
        {
          id: 'role-1',
          name: 'SUPER_ADMIN',
          isSystem: true,
          permissions: [
            { id: '1', action: 'manage:roles', description: 'Can manage roles and permissions' },
            { id: '3', action: 'delete:users', description: 'Can delete user accounts' },
          ],
        },
        {
          id: 'role-2',
          name: 'EMPLOYER',
          isSystem: true,
          permissions: [{ id: '2', action: 'create:jobs', description: 'Can post new jobs' }],
        },
      ]);
      setIsLoading(false);
    }, 800);
  }, []);

  if (isLoading) {
    return (
      <div className="flex space-x-2 justify-center items-center h-64">
        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
        <div
          className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div
          className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-200">Active Roles</h2>
        <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center space-x-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            ></path>
          </svg>
          <span>Create New Role</span>
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div
            key={role.id}
            className="group relative bg-slate-800/80 rounded-2xl border border-slate-700 p-6 flex flex-col justify-between overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/20 hover:border-indigo-500/50"
          >
            {/* System Badge */}
            {role.isSystem && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-slate-700/80 rounded-bl-lg text-xs font-medium text-slate-300 border-b border-l border-slate-600/50 backdrop-blur-sm">
                System Role
              </div>
            )}

            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center mb-4">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 shadow-inner shadow-indigo-500/20">
                  {role.name.charAt(0)}
                </span>
                {role.name}
              </h3>

              <div className="space-y-2 mt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Permissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {role.permissions.map((p) => (
                    <span
                      key={p.id}
                      className="px-2.5 py-1 rounded-md bg-slate-700/50 border border-slate-600/50 text-xs text-slate-300 hover:bg-slate-600 transition-colors cursor-default"
                      title={p.description}
                    >
                      {p.action}
                    </span>
                  ))}
                  {role.permissions.length === 0 && (
                    <span className="text-sm text-slate-500 italic">No permissions assigned</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-700/50 flex justify-end space-x-3 opacity-80 group-hover:opacity-100 transition-opacity">
              <button className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-medium">
                Edit
              </button>
              {!role.isSystem && (
                <button className="text-slate-400 hover:text-red-400 transition-colors text-sm font-medium">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
