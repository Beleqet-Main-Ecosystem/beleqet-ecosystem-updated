'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  CheckCircle,
  Archive,
  RefreshCw,
  Filter,
  Sparkles,
  Layers,
  XCircle,
} from 'lucide-react';
import {
  fetchModerationItems,
  updateJobModerationStatus,
  updateGigModerationStatus,
  ModerationItemRecord,
} from '@/lib/api';

export default function AdminJobsModerationPage() {
  const [items, setItems] = useState<ModerationItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'JOB' | 'GIG'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await fetchModerationItems({
        type: typeFilter,
      });
      setItems(data || []);
    } catch (err) {
      console.error('Failed to load moderation items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [typeFilter]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.creatorName?.toLowerCase().includes(search.toLowerCase()) ||
        item.category?.toLowerCase().includes(search.toLowerCase()) ||
        item.location?.toLowerCase().includes(search.toLowerCase()) ||
        item.id?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        item.status?.toUpperCase() === statusFilter.toUpperCase() ||
        (statusFilter === 'APPROVED' && (item.status === 'PUBLISHED' || item.status === 'OPEN')) ||
        (statusFilter === 'PENDING' && (item.status === 'DRAFT' || item.status === 'FUNDED')) ||
        (statusFilter === 'REJECTED' && (item.status === 'ARCHIVED' || item.status === 'CANCELLED'));

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const handleApprove = async (item: ModerationItemRecord) => {
    try {
      setActionLoading(item.id);
      if (item.type === 'JOB') {
        await updateJobModerationStatus(item.id, 'PUBLISHED');
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'PUBLISHED' } : i)),
        );
      } else {
        await updateGigModerationStatus(item.id, 'OPEN');
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'OPEN' } : i)),
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve listing');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (item: ModerationItemRecord) => {
    const reason = confirm('Are you sure you want to reject / archive this posting?');
    if (!reason) return;

    try {
      setActionLoading(item.id);
      if (item.type === 'JOB') {
        await updateJobModerationStatus(item.id, 'ARCHIVED');
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'ARCHIVED' } : i)),
        );
      } else {
        await updateGigModerationStatus(item.id, 'CANCELLED');
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'CANCELLED' } : i)),
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reject listing');
    } finally {
      setActionLoading(null);
    }
  };

  const isApproved = (status: string) => status === 'PUBLISHED' || status === 'OPEN';
  const isRejected = (status: string) => status === 'ARCHIVED' || status === 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-[#00653B]" /> Job & Gig Moderation Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review employer job postings and client freelance gigs, verify compensation terms, approve or reject listings.
          </p>
        </div>

        <button
          onClick={loadItems}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Queue
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Search */}
        <div className="sm:col-span-2 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, employer/client, or category..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-[#00653B]"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Types (Jobs & Gigs)</option>
            <option value="JOB">Full/Part-Time Jobs</option>
            <option value="GIG">Freelance Gigs</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review (Draft/Funded)</option>
            <option value="APPROVED">Approved (Live / Open)</option>
            <option value="REJECTED">Rejected (Archived / Cancelled)</option>
          </select>
        </div>
      </div>

      {/* Moderation Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Listing Title</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Poster / Employer</th>
                <th className="px-4 py-3.5">Compensation</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Date Created</th>
                <th className="px-5 py-3.5 text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Loading moderation queue...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No postings found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition">
                    {/* Listing Title & Category */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {item.location || 'Remote'} {item.category && `• ${item.category}`}
                        </p>
                      </div>
                    </td>

                    {/* Posting Type Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                          item.type === 'GIG'
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40'
                        }`}
                      >
                        {item.type === 'GIG' ? <Sparkles className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {item.type === 'GIG' ? 'GIG' : 'JOB'}
                      </span>
                    </td>

                    {/* Poster */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.creatorName}
                      </p>
                      {item.creatorEmail && (
                        <p className="text-[10px] text-slate-400 truncate">{item.creatorEmail}</p>
                      )}
                    </td>

                    {/* Compensation */}
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {item.compensation}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                          isApproved(item.status)
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isRejected(item.status)
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="px-4 py-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>

                    {/* Moderation Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {!isApproved(item.status) && (
                          <button
                            onClick={() => handleApprove(item)}
                            disabled={actionLoading === item.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#00653B] hover:bg-[#005230] px-2.5 py-1 text-[11px] font-bold text-white transition disabled:opacity-50"
                            title="Approve & Publish to Public"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}

                        {!isRejected(item.status) && (
                          <button
                            onClick={() => handleReject(item)}
                            disabled={actionLoading === item.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-800 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-50"
                            title="Reject & Archive"
                          >
                            <Archive className="h-3.5 w-3.5" /> Reject
                          </button>
                        )}
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
