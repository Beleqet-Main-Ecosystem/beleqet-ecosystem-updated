import { ActionError, call } from './actions';

export type Deliverable = { id: string; fileUrl?: string | null; notes?: string | null; submittedAt: string };

export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED';

export type Milestone = {
  id: string;
  title: string;
  amount: number;
  deadline: string;
  status: MilestoneStatus;
  approvedAt?: string | null;
  /** The client's latest "what should change" note. */
  revisionNote?: string | null;
  revisionRequestedAt?: string | null;
  deliverables?: Deliverable[];
};

type Party = { id: string; firstName: string; lastName: string };

export type Contract = {
  id: string;
  freelanceJobId: string;
  clientId: string;
  freelancerId: string;
  agreedAmount: number;
  currency: string;
  status: 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';
  startedAt: string;
  freelanceJob: {
    title: string;
    escrowTx?: { status: string; grossAmount: number; fundedAt?: string | null } | null;
  };
  client: Party;
  freelancer: Party;
  milestones: Milestone[];
};

/** Null when the contract doesn't exist or the viewer isn't one of its two parties. */
export async function fetchContract(id: string): Promise<Contract | null> {
  try {
    return await call<Contract>(`/freelance/contracts/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ActionError && err.status === 404) return null;
    throw err;
  }
}

export function fundEscrow(gigId: string): Promise<{ checkoutUrl?: string }> {
  return call(`/escrow/initiate/${encodeURIComponent(gigId)}`, { method: 'POST' });
}

export function addMilestone(contractId: string, milestone: { title: string; amount: number; deadline: string }): Promise<Milestone> {
  return call(`/freelance/contracts/${encodeURIComponent(contractId)}/milestones`, { method: 'POST', body: JSON.stringify(milestone) });
}

export function releaseMilestone(id: string): Promise<unknown> {
  return call(`/freelance/milestones/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
}

export function requestRevision(id: string, reason: string): Promise<unknown> {
  return call(`/freelance/milestones/${encodeURIComponent(id)}/request-revision`, { method: 'PATCH', body: JSON.stringify({ reason }) });
}

export function submitWork(id: string, work: { fileUrl?: string; notes: string }): Promise<unknown> {
  return call(`/freelance/milestones/${encodeURIComponent(id)}/deliverables`, { method: 'POST', body: JSON.stringify(work) });
}

export function raiseDispute(contractId: string, reason: string): Promise<unknown> {
  return call(`/freelance/contracts/${encodeURIComponent(contractId)}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
}
