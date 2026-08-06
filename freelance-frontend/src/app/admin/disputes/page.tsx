'use client';
import { useState, useCallback, type ChangeEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { fetchAllDisputes, resolveDispute } from '@/lib/api';
import { usePolling } from '@/hooks/usePolling';
import type { Dispute } from '@/types';

const POLLING_INTERVAL_MS = 10_000;

/** Returns the correct CSS class for a dispute's badge */
function getDisputeBadge(resolution: string | null): string {
  return resolution ? 'badge badge-resolved' : 'badge badge-open';
}

/** Formats a date string to a human-readable form */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Dispute Manager page.
 * Admin-only page listing all active disputes.
 * Polls the backend every 10 seconds for fresh data.
 * Allows resolving a dispute (optionally with a refund amount) via a modal.
 */
export default function DisputesPage() {
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [resolveError, setResolveError] = useState('');

  const fetcher = useCallback(() => fetchAllDisputes(), []);
  const {
    data: disputes,
    loading,
    error,
    refetch,
  } = usePolling<Dispute[]>(fetcher, POLLING_INTERVAL_MS);

  function openModal(dispute: Dispute) {
    setSelectedDispute(dispute);
    setResolution('');
    setRefundAmount('');
    setResolveError('');
    setSuccessMsg('');
  }

  function closeModal() {
    setSelectedDispute(null);
  }

  async function handleResolve() {
    if (!selectedDispute || !resolution.trim()) {
      setResolveError('A resolution message is required.');
      return;
    }
    setSubmitting(true);
    setResolveError('');
    try {
      const refund = refundAmount ? parseFloat(refundAmount) : undefined;
      await resolveDispute(selectedDispute.id, resolution, refund);
      setSuccessMsg('Dispute resolved successfully.');
      refetch();
      setTimeout(closeModal, 1500);
    } catch {
      setResolveError('Failed to resolve dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = disputes?.filter((d) => !d.resolution).length ?? 0;
  const resolvedCount = disputes?.filter((d) => d.resolution).length ?? 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Dispute Manager</h1>
          <p className="page-header-subtitle">
            Resolve freelancer and client disputes with confidence.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {pendingCount} open · {resolvedCount} resolved
          </span>
          <div className="polling-indicator">
            <span className="polling-dot" />
            <span>Live updates every 10s</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        {loading && !disputes ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading disputes…</span>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header-row">
              <div className="table-title">All Disputes</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}
              >
                <ShieldCheck size={16} />
                <span>Admin review panel</span>
              </div>
            </div>

            {!disputes || disputes.length === 0 ? (
              <div className="empty-state">
                No disputes found. The platform is operating normally.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Reason</th>
                    <th>Evidence</th>
                    <th>Agreed Amount</th>
                    <th>Status</th>
                    <th>Raised At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute) => (
                    <tr key={dispute.id}>
                      <td>
                        <span className="text-primary" style={{ fontWeight: 600, fontSize: 12 }}>
                          #{dispute.contractId.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <span className="truncate">{dispute.reason}</span>
                      </td>
                      <td>
                        {dispute.evidenceUrls.length > 0 ? (
                          <span>{dispute.evidenceUrls.length} file(s)</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {dispute.contract
                          ? `${dispute.contract.agreedAmount.toLocaleString()} ${dispute.contract.currency}`
                          : '—'}
                      </td>
                      <td>
                        <span className={getDisputeBadge(dispute.resolution)}>
                          {dispute.resolution ? 'Resolved' : 'Open'}
                        </span>
                      </td>
                      <td>{formatDate(dispute.createdAt)}</td>
                      <td>
                        {!dispute.resolution ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openModal(dispute)}
                          >
                            Resolve
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/*  Resolve Modal  */}
      {selectedDispute && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Resolve Dispute</div>
            <div className="modal-subtitle">
              Contract #{selectedDispute.contractId.slice(0, 8)} — provide your administrative
              decision.
            </div>

            {/* Dispute Reason (read-only) */}
            <div className="form-group">
              <label className="form-label">Dispute Reason (GDPR sanitized)</label>
              <textarea value={selectedDispute.reason} readOnly style={{ opacity: 0.6 }} />
            </div>

            {/* Resolution */}
            <div className="form-group">
              <label className="form-label" htmlFor="resolution">
                Resolution Decision *
              </label>
              <textarea
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describe your ruling and the actions to be taken…"
              />
            </div>

            {/* Optional Refund */}
            <div className="form-group">
              <label className="form-label" htmlFor="refundAmount">
                Refund Amount (optional — leave blank to mark as Completed)
              </label>
              <input
                id="refundAmount"
                type="number"
                min="0"
                value={refundAmount}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setRefundAmount(event.target.value)
                }
                placeholder={`Amount in ${selectedDispute.contract?.currency ?? 'ETB'}`}
              />
            </div>

            {resolveError && <div className="login-error">{resolveError}</div>}
            {successMsg && (
              <div style={{ color: 'var(--accent-green)', fontSize: 13, marginBottom: 8 }}>
                ✓ {successMsg}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleResolve} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
