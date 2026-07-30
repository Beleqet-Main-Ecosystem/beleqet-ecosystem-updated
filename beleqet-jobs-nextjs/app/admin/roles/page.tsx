import React from 'react';
import RoleManager from './components/RoleManager';
import RbacGuard from '../../../components/auth/RbacGuard';

export const metadata = {
  title: 'Role Management | Beleqet Admin',
  description: 'Manage roles and permissions for the Beleqet ecosystem.',
};

export default function RolesAdminPage() {
  return (
    <RbacGuard requiredPermissions={['manage:roles']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 p-8 pt-24 font-inter">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <header className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              Role Management (RBAC)
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl">
              Configure dynamic roles and securely manage granular permissions across the ecosystem. Ensuring GDPR-compliant access controls.
            </p>
          </header>

          <main className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10 hover:border-slate-600/50">
            <RoleManager />
          </main>
          
        </div>
      </div>
    </RbacGuard>
  );
}
