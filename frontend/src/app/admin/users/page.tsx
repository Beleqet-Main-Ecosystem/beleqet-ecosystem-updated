'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  Trash2,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserCheck,
  UserX,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  AdminUserRecord,
} from '@/lib/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(search.toLowerCase()) ||
        u.id?.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'BANNED' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, newRole: AdminUserRecord['role']) => {
    try {
      setActionLoading(userId);
      await updateAdminUser(userId, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (userId: string, currentActive: boolean) => {
    const actionName = currentActive ? 'ban' : 'activate';
    if (!confirm(`Are you sure you want to ${actionName} this user account?`)) {
      return;
    }
    try {
      setActionLoading(userId);
      const updated = await updateAdminUser(userId, { isActive: !currentActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: updated.isActive } : u)),
      );
    } catch (err: any) {
      alert(err.message || `Failed to ${actionName} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleKyc = async (userId: string, currentKyc?: boolean) => {
    try {
      setActionLoading(userId);
      const updated = await updateAdminUser(userId, { kycVerified: !currentKyc });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, kycVerified: updated.kycVerified } : u)),
      );
    } catch (err: any) {
      alert(err.message || 'Failed to update KYC status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
      return;
    }
    try {
      setActionLoading(userId);
      const res = await deleteAdminUser(userId);
      if (res.deleted) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert(res.reason || 'Failed to delete user');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-[#00653B]" /> User Management & Moderation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Search platform users, change RBAC roles, toggle active/banned status, and verify credentials.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or user ID..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-[#00653B]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="JOB_SEEKER">Job Seekers</option>
            <option value="FREELANCER">Freelancers</option>
            <option value="EMPLOYER">Employers</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="BANNED">Banned / Suspended</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Account Status</th>
                <th className="px-4 py-3.5">KYC Verified</th>
                <th className="px-4 py-3.5">2FA Auth</th>
                <th className="px-4 py-3.5">Registered</th>
                <th className="px-5 py-3.5 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No users match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                    {/* User Info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[#00653B] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                          {u.firstName?.[0] || 'U'}
                          {u.lastName?.[0] || ''}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          <p className="text-[10px] text-slate-400/80 font-mono truncate">{u.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role Selection Dropdown */}
                    <td className="px-4 py-3.5">
                      <select
                        value={u.role}
                        disabled={actionLoading === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 outline-none hover:border-[#00653B] focus:border-[#00653B]"
                      >
                        <option value="JOB_SEEKER">JOB_SEEKER</option>
                        <option value="FREELANCER">FREELANCER</option>
                        <option value="EMPLOYER">EMPLOYER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>

                    {/* Account Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {u.isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {u.isActive ? 'ACTIVE' : 'BANNED'}
                      </span>
                    </td>

                    {/* KYC Verification Toggle */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleKyc(u.id, u.kycVerified)}
                        disabled={actionLoading === u.id}
                        title="Click to toggle KYC verification status"
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold transition hover:opacity-80 ${
                          u.kycVerified
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {u.kycVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                        {u.kycVerified ? 'VERIFIED' : 'UNVERIFIED'}
                      </button>
                    </td>

                    {/* 2FA Auth */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] text-slate-500">
                        {u.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>

                    {/* Registered Date */}
                    <td className="px-4 py-3.5 text-[11px] text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Moderation Actions (Ban/Activate Toggle & Delete) */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {u.isActive ? (
                          <button
                            onClick={() => handleToggleStatus(u.id, true)}
                            disabled={actionLoading === u.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition"
                            title="Ban user account"
                          >
                            <UserX className="h-3.5 w-3.5" /> Ban
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(u.id, false)}
                            disabled={actionLoading === u.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition"
                            title="Activate / Unban user account"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={actionLoading === u.id}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
