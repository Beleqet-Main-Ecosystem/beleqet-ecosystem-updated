'use client';

import { useEffect, useState } from 'react';
import type { FraudRule } from '@/types/fraud';
import { getFraudRules, updateFraudRule } from '@/lib/api';

export default function FraudRulesPage() {
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = () => {
    setLoading(true);
    getFraudRules()
      .then(setRules)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRules(); }, []);

  const toggleEnabled = async (rule: FraudRule) => {
    try {
      const updated = await updateFraudRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Loading rules...</p>;
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>;

  return (
    <div>
      <h1>Fraud Detection Rules</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule) => (
          <div
            key={rule.id}
            style={{
              background: 'white',
              borderRadius: 8,
              padding: '12px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <strong>{rule.name}</strong>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Type: {rule.ruleType.replace(/_/g, ' ')} | Severity: {rule.severity}
              </div>
            </div>
            <button
              onClick={() => toggleEnabled(rule)}
              style={{
                padding: '6px 18px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                background: rule.enabled ? '#4caf50' : '#f44336',
                color: 'white',
              }}
            >
              {rule.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
