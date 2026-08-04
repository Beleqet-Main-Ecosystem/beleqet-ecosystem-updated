'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { FraudAlert } from '@/types/fraud';
import { getFraudAlert, resolveFraudAlert } from '@/lib/api';
import { ApiErrorState } from '@/components/ApiErrorState';

export default function FraudAlertDetailPage() {
  const params = useParams<{ id: string }>();
  const [alert, setAlert] = useState<FraudAlert | null>(null);
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getFraudAlert(params.id)
      .then(({ alert: a, context: c }) => { setAlert(a); setContext(c); })
      .catch((e) => setLoadError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleResolve = async (status: 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED') => {
    setResolving(true);
    setMessage(null);
    try {
      const result = await resolveFraudAlert(params.id, { status, resolutionNote });
      setAlert(result.alert);
      setMessage(`Alert ${status.replace(/_/g, ' ').toLowerCase()}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (loadError) return <ApiErrorState error={loadError} />;
  if (!alert) return <p style={{ padding: 24 }}>Alert not found.</p>;

  return (
    <div>
      <h1>Fraud Alert Detail</h1>
      {message && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 6,
          marginBottom: 16,
          background: message.startsWith('Alert ') ? '#e8f5e9' : '#ffebee',
          color: message.startsWith('Alert ') ? '#2e7d32' : '#c62828',
        }}>
          {message}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Alert #{alert.id.slice(0, 8)}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Info label="Rule Type" value={alert.ruleType.replace(/_/g, ' ')} />
          <Info label="Status" value={alert.status.replace(/_/g, ' ')} />
          <Info label="Severity" value={alert.severity} />
          <Info label="Score" value={`${alert.score} / 100`} />
          <Info label="Entity Type" value={alert.entityType} />
          <Info label="Currency" value={alert.currency || 'N/A'} />
          <Info label="Created" value={new Date(alert.createdAt).toLocaleString()} />
          {alert.resolvedAt && (
            <Info label="Resolved" value={new Date(alert.resolvedAt).toLocaleString()} />
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Reason:</strong>
          <p style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, marginTop: 4 }}>
            {alert.reason}
          </p>
        </div>

        {alert.evidence && (
          <div style={{ marginTop: 16 }}>
            <strong>Evidence:</strong>
            <pre style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </div>
        )}

        {alert.resolutionNote && (
          <div style={{ marginTop: 16 }}>
            <strong>Resolution Note:</strong>
            <p style={{ background: '#f0f4c3', padding: 12, borderRadius: 6, marginTop: 4 }}>
              {alert.resolutionNote}
            </p>
          </div>
        )}

        {alert.user && (
          <div style={{ marginTop: 16 }}>
            <strong>Flagged User:</strong> {alert.user.firstName} {alert.user.lastName} ({alert.user.email})
          </div>
        )}
      </div>

      {context && (
        <div style={{ background: 'white', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 16 }}>
          <h3>Related Context</h3>
          {context.message && (
            <div>
              <strong>Message:</strong>
              <pre style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(context.message, null, 2)}
              </pre>
            </div>
          )}
          {context.user && !alert.user && (
            <div>
              <strong>User:</strong>
              <pre style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: '12px' }}>
                {JSON.stringify(context.user, null, 2)}
              </pre>
            </div>
          )}
          {context.job && (
            <div>
              <strong>Job:</strong>
              <pre style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: '12px' }}>
                {JSON.stringify(context.job, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {alert.status === 'OPEN' && (
        <div style={{ background: 'white', borderRadius: 8, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Resolve Alert</h3>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Add a resolution note (optional)..."
            aria-label="Resolution note"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 12,
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: '14px',
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => handleResolve('RESOLVED')}
              disabled={resolving}
              style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {resolving ? 'Resolving...' : 'Mark Resolved'}
            </button>
            <button
              onClick={() => handleResolve('FALSE_POSITIVE')}
              disabled={resolving}
              style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {resolving ? 'Resolving...' : 'Mark False Positive'}
            </button>
            <button
              onClick={() => handleResolve('CONFIRMED')}
              disabled={resolving}
              style={{ padding: '10px 20px', background: '#f44336', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              {resolving ? 'Resolving...' : 'Confirm Fraud'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: '#888', fontSize: '13px' }}>{label}</span>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
