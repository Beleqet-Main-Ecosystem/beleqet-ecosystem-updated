'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
  Clock,
  CheckCheck,
  Ban,
  Receipt,
} from 'lucide-react';
import {
  approveManualPayment,
  fetchManualPaymentReceiptUrl,
  fetchManualPayments,
  rejectManualPayment,
  type ManualPaymentRecord,
} from '@/lib/api';

function formatMinorAmount(amount: number, currency: string): string {
  const major = amount / 100;
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(major);
}

function getBadgeClass(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'badge badge-pending';
    case 'PROCESSING':
      return 'badge badge-processing';
    case 'SUCCEEDED':
      return 'badge badge-succeeded';
    case 'FAILED':
    case 'CANCELLED':
      return 'badge badge-failed';
    default:
      return 'badge';
  }
}

export default function AdminManualPaymentsPage() {
  const [payments, setPayments] = useState<ManualPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'SUCCEEDED' | 'FAILED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const LIMIT = 50;

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<ManualPaymentRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Receipt preview modal state
  const [previewPayment, setPreviewPayment] = useState<ManualPaymentRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewImgError, setPreviewImgError] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchManualPayments(p, LIMIT);
      setPayments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  // Open receipt preview modal
  const handleOpenReceipt = async (payment: ManualPaymentRecord) => {
    setPreviewPayment(payment);
    setPreviewUrl(null);
    setPreviewImgError(false);
    setPreviewLoading(true);
    try {
      // Fetch resolved presigned / accessible URL from backend
      const res = await fetchManualPaymentReceiptUrl(payment.id);
      setPreviewUrl(res.url);
    } catch {
      // Fallback to static URL
      if (payment.receiptUrl) {
        setPreviewUrl(payment.receiptUrl);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle payment approval
  const handleApprove = async (paymentId: string) => {
    setActionLoadingId(paymentId);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await approveManualPayment(paymentId);
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
      if (previewPayment && previewPayment.id === paymentId) {
        setPreviewPayment(updated);
      }
      setSuccessMsg(`Payment ${paymentId.slice(0, 8)} approved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve payment.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle payment rejection
  const handleConfirmReject = async () => {
    if (!rejectingPayment) return;
    const paymentId = rejectingPayment.id;
    setActionLoadingId(paymentId);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await rejectManualPayment(paymentId, rejectionReason.trim() || undefined);
      setPayments((prev) => prev.map((p) => (p.id === paymentId ? updated : p)));
      if (previewPayment && previewPayment.id === paymentId) {
        setPreviewPayment(updated);
      }
      setSuccessMsg(`Payment ${paymentId.slice(0, 8)} marked as rejected.`);
      setRejectingPayment(null);
      setRejectionReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject payment.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Computed summary metrics
  const stats = useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').length;
    const approved = payments.filter((p) => p.status === 'SUCCEEDED').length;
    const rejected = payments.filter((p) => p.status === 'FAILED' || p.status === 'CANCELLED').length;
    return { total, pending, approved, rejected };
  }, [payments]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Status filter
      if (activeFilter === 'PENDING' && p.status !== 'PENDING' && p.status !== 'PROCESSING') {
        return false;
      }
      if (activeFilter === 'SUCCEEDED' && p.status !== 'SUCCEEDED') {
        return false;
      }
      if (activeFilter === 'FAILED' && p.status !== 'FAILED' && p.status !== 'CANCELLED') {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchId = p.id.toLowerCase().includes(query);
        const matchUserId = p.userId?.toLowerCase().includes(query);
        const matchRef = p.transactionReference?.toLowerCase().includes(query);
        if (!matchId && !matchUserId && !matchRef) return false;
      }

      return true;
    });
  }, [payments, activeFilter, searchQuery]);

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Manual Payments</h1>
          <p className="page-header-subtitle">
            Review customer bank transfer receipts, verify transaction references, and approve payments.
          </p>
        </div>
        <button
          onClick={() => void load(page)}
          disabled={loading}
          aria-label="Refresh manual payments list"
          className="btn btn-ghost"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="page-body">
        {/* Success Alert */}
        {successMsg && (
          <div className="alert-box alert-box-success" role="status">
            <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{successMsg}</div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="btn btn-ghost"
              style={{ padding: 4, minHeight: 0 }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert-box alert-box-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{error}</div>
            <button
              onClick={() => setError(null)}
              className="btn btn-ghost"
              style={{ padding: 4, minHeight: 0 }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}
            >
              <Receipt size={22} />
            </div>
            <div className="stat-card-label">Total Submissions</div>
            <div className="stat-card-value">{stats.total}</div>
          </div>

          <div className="stat-card">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}
            >
              <Clock size={22} />
            </div>
            <div className="stat-card-label">Needs Verification</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-amber)' }}>
              {stats.pending}
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green)' }}
            >
              <CheckCheck size={22} />
            </div>
            <div className="stat-card-label">Approved & Settled</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-green)' }}>
              {stats.approved}
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-card-icon"
              style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)' }}
            >
              <Ban size={22} />
            </div>
            <div className="stat-card-label">Rejected / Invalid</div>
            <div className="stat-card-value" style={{ color: 'var(--accent-rose)' }}>
              {stats.rejected}
            </div>
          </div>
        </div>

        {/* Toolbar: Filter Tabs & Search */}
        <div className="admin-toolbar-row">
          <div className="admin-filter-tabs">
            <button
              className={`admin-filter-tab ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({payments.length})
            </button>
            <button
              className={`admin-filter-tab ${activeFilter === 'PENDING' ? 'active' : ''}`}
              onClick={() => setActiveFilter('PENDING')}
            >
              Pending ({stats.pending})
            </button>
            <button
              className={`admin-filter-tab ${activeFilter === 'SUCCEEDED' ? 'active' : ''}`}
              onClick={() => setActiveFilter('SUCCEEDED')}
            >
              Approved ({stats.approved})
            </button>
            <button
              className={`admin-filter-tab ${activeFilter === 'FAILED' ? 'active' : ''}`}
              onClick={() => setActiveFilter('FAILED')}
            >
              Rejected ({stats.rejected})
            </button>
          </div>

          <div className="admin-search-wrapper">
            <Search size={15} className="admin-search-icon" />
            <input
              type="text"
              placeholder="Search by Payment ID or Reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table / Empty State */}
        {loading && payments.length === 0 ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading manual payments…</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <FileText size={40} style={{ color: 'var(--text-muted)' }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>No payments match your criteria</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {searchQuery
                ? `No transactions found matching "${searchQuery}".`
                : 'There are currently no manual payments in this category.'}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header-row">
              <div className="table-title">Payment Submissions ({filteredPayments.length})</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>User ID</th>
                    <th>Amount</th>
                    <th>Reference</th>
                    <th>Receipt</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const isActionLoading = actionLoadingId === p.id;
                    const canAct = p.status === 'PENDING' || p.status === 'PROCESSING';

                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {p.id.slice(0, 8)}…
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {p.userId ? `${p.userId.slice(0, 8)}…` : '—'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatMinorAmount(p.amount, p.currency)}
                        </td>
                        <td>
                          {p.transactionReference ? (
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                background: 'var(--bg-card)',
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                              }}
                            >
                              {p.transactionReference}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        <td>
                          {p.receiptUrl ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenReceipt(p)}
                              className="btn btn-ghost btn-sm"
                              style={{ gap: 6, padding: '4px 10px', fontSize: 12 }}
                            >
                              <Eye size={13} />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 12 }}>
                              No file
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={getBadgeClass(p.status)}>{p.status}</span>
                          {p.metadata &&
                          typeof p.metadata === 'object' &&
                          (p.metadata as Record<string, unknown>).rejectionReason ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--accent-rose)',
                                marginTop: 4,
                                maxWidth: 180,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={String((p.metadata as Record<string, unknown>).rejectionReason)}
                            >
                              Reason: {String((p.metadata as Record<string, unknown>).rejectionReason)}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(p.createdAt).toLocaleDateString('en-ET', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td>
                          {canAct ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => void handleApprove(p.id)}
                                disabled={isActionLoading}
                                title="Approve Payment"
                                className="btn btn-primary btn-sm"
                                style={{
                                  background: 'var(--accent-green)',
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  gap: 5,
                                }}
                              >
                                {isActionLoading ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Check size={13} />
                                )}
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingPayment(p)}
                                disabled={isActionLoading}
                                title="Reject Payment"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '5px 10px', fontSize: 12, gap: 5 }}
                              >
                                <X size={13} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-bar">
              <div className="pagination-info">Page {page}</div>
              <div className="pagination-actions">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="btn btn-ghost btn-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={payments.length < LIMIT || loading}
                  className="btn btn-ghost btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {previewPayment && (
        <div className="modal-overlay" onClick={() => setPreviewPayment(null)}>
          <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="receipt-modal-header">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Payment Receipt Preview
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                  ID: {previewPayment.id} • Ref: {previewPayment.transactionReference ?? 'None'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ gap: 6 }}
                  >
                    <span>Open in tab</span>
                    <ExternalLink size={13} />
                  </a>
                )}
                <button
                  onClick={() => {
                    setPreviewPayment(null);
                    setPreviewUrl(null);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: 6 }}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="receipt-modal-body">
              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading receipt file…</div>
                </div>
              ) : previewUrl ? (
                (() => {
                  const cleanUrl = previewUrl.split('?')[0].toLowerCase();
                  const isPdf = cleanUrl.endsWith('.pdf');

                  if (isPdf) {
                    return (
                      <iframe
                        src={previewUrl}
                        title="Receipt PDF"
                        style={{
                          width: '100%',
                          height: '520px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: '#ffffff',
                        }}
                      />
                    );
                  }

                  if (previewImgError) {
                    return (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 12,
                          padding: 32,
                          textAlign: 'center',
                        }}
                      >
                        <AlertCircle size={36} style={{ color: 'var(--accent-amber)' }} />
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Inline preview unavailable</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
                          The browser was unable to render the image directly. You can open the file in a new tab.
                        </div>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 8 }}
                        >
                          <ExternalLink size={14} />
                          Open Receipt File Directly
                        </a>
                      </div>
                    );
                  }

                  return (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewUrl}
                      alt="Payment Receipt"
                      onError={() => setPreviewImgError(true)}
                      style={{
                        maxHeight: '520px',
                        maxWidth: '100%',
                        borderRadius: 'var(--radius-sm)',
                        objectFit: 'contain',
                        border: '1px solid var(--border)',
                      }}
                    />
                  );
                })()
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    color: 'var(--text-muted)',
                  }}
                >
                  <FileText size={36} />
                  <div style={{ fontSize: 14 }}>Unable to load receipt file preview.</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="receipt-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatMinorAmount(previewPayment.amount, previewPayment.currency)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className={getBadgeClass(previewPayment.status)}>{previewPayment.status}</span>
              </div>

              {(previewPayment.status === 'PENDING' || previewPayment.status === 'PROCESSING') && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => void handleApprove(previewPayment.id)}
                    disabled={actionLoadingId === previewPayment.id}
                    className="btn btn-primary btn-sm"
                    style={{ background: 'var(--accent-green)', gap: 6 }}
                  >
                    {actionLoadingId === previewPayment.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Approve Payment
                  </button>
                  <button
                    onClick={() => setRejectingPayment(previewPayment)}
                    disabled={actionLoadingId === previewPayment.id}
                    className="btn btn-danger btn-sm"
                    style={{ gap: 6 }}
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal */}
      {rejectingPayment && (
        <div className="modal-overlay" onClick={() => setRejectingPayment(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: 'var(--accent-rose)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <XCircle size={18} />
              </div>
              <div className="modal-title" style={{ margin: 0 }}>
                Reject Payment Receipt
              </div>
            </div>

            <p className="modal-subtitle">
              Specify the reason for rejecting payment{' '}
              <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {rejectingPayment.id.slice(0, 8)}
              </strong>{' '}
              ({formatMinorAmount(rejectingPayment.amount, rejectingPayment.currency)}):
            </p>

            <div className="form-group">
              <label htmlFor="rejectionReason" className="form-label">
                Rejection Reason
              </label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Reference number not found in bank statement, invalid amount, blurry receipt image, etc."
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setRejectingPayment(null);
                  setRejectionReason('');
                }}
                disabled={actionLoadingId === rejectingPayment.id}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReject()}
                disabled={actionLoadingId === rejectingPayment.id}
                className="btn btn-danger btn-sm"
                style={{ gap: 6 }}
              >
                {actionLoadingId === rejectingPayment.id && <Loader2 size={13} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
