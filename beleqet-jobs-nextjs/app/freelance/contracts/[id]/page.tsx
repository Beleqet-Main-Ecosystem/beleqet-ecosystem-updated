'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowLeft,
  Upload,
  MessageSquare,
  Lock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { getStoredUser, getToken } from '@/lib/auth';

interface Deliverable {
  id: string;
  milestoneId: string;
  fileUrl?: string;
  notes?: string;
  submittedAt: string;
}

interface Milestone {
  id: string;
  contractId: string;
  title: string;
  description?: string;
  amount: number;
  deadline: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED';
  approvedAt?: string;
  deliverables?: Deliverable[];
}

interface Contract {
  id: string;
  freelanceJobId: string;
  clientId: string;
  freelancerId: string;
  agreedAmount: number;
  currency: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  startedAt: string;
  completedAt?: string;
  freelanceJob: {
    id: string;
    title: string;
    description: string;
    category?: { name: string };
  };
  client: {
    id: string;
    firstName: string;
    lastName: string;
  };
  freelancer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  milestones: Milestone[];
}

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params?.id as string;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deliverable modal state
  const [submittingMilestoneId, setSubmittingMilestoneId] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [deliverableNotes, setDeliverableNotes] = useState('');

  const currentUser = getStoredUser();
  const isClient = currentUser?.id === contract?.clientId;
  const isFreelancer = currentUser?.id === contract?.freelancerId;

  const fetchContract = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

      const res = await fetch(`${apiUrl}/freelance/contracts/${contractId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to load contract details');
      }

      const data = await res.json();
      setContract(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching contract');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (contractId) {
      fetchContract();
    }
  }, [contractId, fetchContract]);

  // Client funds escrow via Chapa/Telebirr
  const handleFundEscrow = async () => {
    if (!contract) return;
    try {
      setActionLoading('funding');
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

      const res = await fetch(`${apiUrl}/escrow/initiate/${contract.freelanceJobId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('Escrow initiated. Complete payment in your banking or wallet portal.');
        fetchContract();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to initiate escrow funding');
    } finally {
      setActionLoading(null);
    }
  };

  // Client releases milestone payment
  const handleReleaseMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to approve this deliverable and release milestone funds?')) {
      return;
    }

    try {
      setActionLoading(milestoneId);
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

      const res = await fetch(`${apiUrl}/freelance/milestones/${milestoneId}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Milestone release failed');
      }

      alert('Milestone funds successfully released to freelancer!');
      fetchContract();
    } catch (err: any) {
      alert(err.message || 'Failed to release milestone');
    } finally {
      setActionLoading(null);
    }
  };

  // Freelancer submits deliverable
  const handleSubmitDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingMilestoneId) return;

    try {
      setActionLoading('submitting-deliverable');
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

      const res = await fetch(`${apiUrl}/freelance/milestones/${submittingMilestoneId}/deliverables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileUrl: fileUrl || undefined,
          notes: deliverableNotes || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Submission failed');
      }

      setSubmittingMilestoneId(null);
      setFileUrl('');
      setDeliverableNotes('');
      fetchContract();
    } catch (err: any) {
      alert(err.message || 'Failed to submit milestone work');
    } finally {
      setActionLoading(null);
    }
  };

  // Client requests revision
  const handleRequestRevision = async (milestoneId: string) => {
    const reason = prompt('Please enter your revision feedback for the freelancer:');
    if (!reason) return;

    try {
      setActionLoading(milestoneId);
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

      const res = await fetch(`${apiUrl}/freelance/milestones/${milestoneId}/request-revision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        throw new Error('Revision request failed');
      }

      fetchContract();
    } catch (err: any) {
      alert(err.message || 'Failed to request revision');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00653B] border-t-transparent" />
          <p className="text-sm font-semibold text-slate-500">Loading contract workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-50 py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Contract Workspace Error</h2>
          <p className="mt-2 text-sm text-slate-600">{error || 'Contract not found'}</p>
          <button
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Return Back
          </button>
        </div>
      </div>
    );
  }

  const totalMilestonesAmount = contract.milestones?.reduce((acc, m) => acc + m.amount, 0) || 0;
  const approvedMilestonesAmount = contract.milestones
    ?.filter((m) => m.status === 'APPROVED')
    .reduce((acc, m) => acc + m.amount, 0) || 0;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-12 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/freelance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Freelance Marketplace
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/messages?contractId=${contract.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <MessageSquare className="h-4 w-4 text-[#00653B]" /> Open Contract Chat
            </Link>
          </div>
        </div>

        {/* Contract Hero Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#00653B] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> BeleqetSafe Escrow Contract
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  {contract.status}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
                {contract.freelanceJob?.title || 'Contract Agreement'}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Contract ID: <span className="font-mono">{contract.id}</span> • Started on{' '}
                {new Date(contract.startedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-2xl bg-[#041603] p-5 text-white sm:text-right shrink-0">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Total Contract Value</p>
              <p className="mt-1 text-2xl font-black text-[#D8FF3E]">
                {contract.agreedAmount.toLocaleString()} {contract.currency}
              </p>
              <p className="mt-0.5 text-[11px] text-white/70">
                Released: {approvedMilestonesAmount.toLocaleString()} {contract.currency}
              </p>
            </div>
          </div>

          {/* Parties involved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client</span>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {contract.client.firstName} {contract.client.lastName} {isClient && '(You)'}
              </p>
              <p className="text-xs text-slate-500">Account Verified • Funds Protected</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Freelancer</span>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {contract.freelancer.firstName} {contract.freelancer.lastName} {isFreelancer && '(You)'}
              </p>
              <p className="text-xs text-slate-500">Escrow Milestone Payout Receiver</p>
            </div>
          </div>

          {/* Client Action: Fund Escrow */}
          {isClient && contract.status === 'ACTIVE' && (
            <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase">BeleqetSafe Escrow Funding</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Deposit milestone funds into escrow via Telebirr, CBE Birr, or debit cards before work starts.
                </p>
              </div>
              <button
                onClick={handleFundEscrow}
                disabled={actionLoading === 'funding'}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#00653B] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#107C41]"
              >
                {actionLoading === 'funding' ? 'Connecting to Gateway...' : 'Fund Escrow (Chapa / Telebirr)'}
              </button>
            </div>
          )}
        </div>

        {/* Milestones Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Contract Milestones & Deliverables</h2>
              <p className="text-xs text-slate-500">
                Funds are released individually per milestone upon deliverable approval.
              </p>
            </div>
          </div>

          {contract.milestones?.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              No milestones defined yet. The agreed contract balance will be handled as a single project milestone.
            </div>
          ) : (
            <div className="space-y-4">
              {contract.milestones.map((m, idx) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs transition hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700 shrink-0">
                        0{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                              m.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : m.status === 'SUBMITTED'
                                ? 'bg-blue-50 text-blue-700'
                                : m.status === 'REVISION_REQUESTED'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {m.status.replace('_', ' ')}
                          </span>
                        </div>
                        {m.description && <p className="mt-1 text-xs text-slate-600">{m.description}</p>}
                        <p className="mt-2 text-xs text-slate-400">
                          Due by: {new Date(m.deadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <span className="text-lg font-black text-slate-900">
                        {m.amount.toLocaleString()} {contract.currency}
                      </span>

                      {/* Action buttons based on Role & Status */}
                      <div className="flex items-center gap-2">
                        {/* Freelancer submit deliverable */}
                        {isFreelancer && (m.status === 'PENDING' || m.status === 'REVISION_REQUESTED') && (
                          <button
                            onClick={() => setSubmittingMilestoneId(m.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#00653B] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#107C41]"
                          >
                            <Upload className="h-3.5 w-3.5" /> Submit Work
                          </button>
                        )}

                        {/* Client approve & release */}
                        {isClient && m.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleRequestRevision(m.id)}
                              disabled={actionLoading === m.id}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Request Revision
                            </button>
                            <button
                              onClick={() => handleReleaseMilestone(m.id)}
                              disabled={actionLoading === m.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Release Escrow
                            </button>
                          </>
                        )}

                        {m.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> Released & Settled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Deliverables attachments list */}
                  {m.deliverables && m.deliverables.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Submitted Deliverables
                      </p>
                      <div className="space-y-2">
                        {m.deliverables.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">{d.notes || 'Deliverable Submission'}</p>
                              <p className="text-[10px] text-slate-400">
                                Submitted {new Date(d.submittedAt).toLocaleString()}
                              </p>
                            </div>
                            {d.fileUrl && (
                              <a
                                href={d.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-[#00653B] hover:underline"
                              >
                                View Deliverable <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deliverable Submission Modal */}
      {submittingMilestoneId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Submit Milestone Work</h3>
            <p className="mt-1 text-xs text-slate-500">
              Provide deliverable links and notes for client approval and escrow release.
            </p>

            <form onSubmit={handleSubmitDeliverable} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Deliverable Link / File URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or Figma link"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-[#00653B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Notes / Summary of Work</label>
                <textarea
                  rows={3}
                  placeholder="Describe the completed work and any testing notes..."
                  value={deliverableNotes}
                  onChange={(e) => setDeliverableNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-[#00653B]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittingMilestoneId(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'submitting-deliverable'}
                  className="rounded-xl bg-[#00653B] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#107C41]"
                >
                  {actionLoading === 'submitting-deliverable' ? 'Submitting...' : 'Submit to Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
