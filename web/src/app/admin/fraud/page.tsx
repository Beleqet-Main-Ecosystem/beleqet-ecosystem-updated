'use client';

import { useEffect, useState } from 'react';
import type { FraudAlert, PaginatedResponse } from '@/types/fraud';
import { getFraudAlerts } from '@/lib/api';
import Link from 'next/link';

const severityColors: Record<string, string> = {
  LOW: '#4caf50',
  MEDIUM: '#ff9800',
  HIGH: '#f44336',
  CRITICAL: '#b71c1c',
};

const statusColors: Record<string, string> = {
  OPEN: '#2196f3',
  UNDER_REVIEW: '#ff9800',
  RESOLVED: '#4caf50',
  FALSE_POSITIVE: '#9e9e9e',
  CONFIRMED: '#f44336',
};

export default function FraudAlertsPage() {
  const [data, setData] = useState<PaginatedResponse<FraudAlert> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ status: '', severity: '', ruleType: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getFraudAlerts({ ...filter, page, limit: 15 })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter, page]);

  if (loading && !data) {
    return <p style={{ padding: 24 }}>Loading fraud alerts...</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <p>Make sure the backend API is running on port 4000.</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Fraud Alerts</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={filter.status}
          onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
          aria-label="Filter by status"
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="UNDER_REVIEW">UNDER_REVIEW</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
          <option value="CONFIRMED">CONFIRMED</option>
        </select>

        <select
          value={filter.severity}
          onChange={(e) => { setFilter({ ...filter, severity: e.target.value }); setPage(1); }}
          aria-label="Filter by severity"
          style={selectStyle}
        >
          <option value="">All Severities</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <select
          value={filter.ruleType}
          onChange={(e) => { setFilter({ ...filter, ruleType: e.target.value }); setPage(1); }}
          aria-label="Filter by rule type"
          style={selectStyle}
        >
          <option value="">All Types</option>
          <option value="OFF_PLATFORM_PAYMENT">Off-Platform Payment</option>
          <option value="FAKE_PROFILE">Fake Profile</option>
          <option value="PAYMENT_ANOMALY">Payment Anomaly</option>
          <option value="DUPLICATE_LISTING">Duplicate Listing</option>
        </select>

        <button
          onClick={() => { setFilter({ status: '', severity: '', ruleType: '' }); setPage(1); }}
          style={{ padding: '6px 16px', cursor: 'pointer' }}
        >
          Clear Filters
        </button>
      </div>

      {data && (
        <>
          <p style={{ color: '#666', marginBottom: 12 }}>
            Showing {(data.meta.page - 1) * data.meta.limit + 1}–
            {Math.min(data.meta.page * data.meta.limit, data.meta.total)} of {data.meta.total} alerts
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.data.map((alert) => (
              <Link
                key={alert.id}
                href={`/admin/fraud/${alert.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{
                  background: 'white',
                  borderRadius: 8,
                  padding: '12px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <strong>{alert.ruleType.replace(/_/g, ' ')}</strong>
                    <p style={{ margin: '4px 0', color: '#555', fontSize: '14px' }}>{alert.reason}</p>
                    {alert.user && (
                      <span style={{ fontSize: '12px', color: '#888' }}>
                        User: {alert.user.firstName} {alert.user.lastName} ({alert.user.email})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'white',
                      background: severityColors[alert.severity] || '#999',
                    }}>
                      {alert.severity}
                    </span>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'white',
                      background: statusColors[alert.status] || '#999',
                    }}>
                      {alert.status.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>
                      Score: {alert.score}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {data.meta.totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{ padding: '6px 14px', cursor: page <= 1 ? 'default' : 'pointer' }}
              >
                Prev
              </button>
              <span style={{ padding: '6px 0' }}>Page {page} of {data.meta.totalPages}</span>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage(page + 1)}
                style={{ padding: '6px 14px', cursor: page >= data.meta.totalPages ? 'default' : 'pointer' }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: '14px',
};
