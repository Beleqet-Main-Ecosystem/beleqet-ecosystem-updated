'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { FraudRule } from '@/types/fraud';
import { createFraudRule, getFraudRules, updateFraudRule } from '@/lib/api';
import { ApiErrorState } from '@/components/ApiErrorState';

const RULE_TYPES = [
  'OFF_PLATFORM_PAYMENT',
  'FAKE_PROFILE',
  'PAYMENT_ANOMALY',
  'DUPLICATE_LISTING',
] as const;

const CONFIG_EXAMPLES: Record<string, string> = {
  OFF_PLATFORM_PAYMENT: JSON.stringify({ threshold: 30, patterns: ['phone', 'email', 'telebirr'] }, null, 2),
  FAKE_PROFILE: JSON.stringify({ maxUnverifiedSkills: 8, requireEmailVerification: true }, null, 2),
  PAYMENT_ANOMALY: JSON.stringify({ zScoreThreshold: 2.5, minimumHistory: 3 }, null, 2),
  DUPLICATE_LISTING: JSON.stringify({ similarityThreshold: 0.8, lookbackDays: 30 }, null, 2),
};

export default function FraudRulesPage() {
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    ruleType: 'OFF_PLATFORM_PAYMENT' as (typeof RULE_TYPES)[number],
    severity: 'MEDIUM',
    enabled: true,
    i18nKey: 'fraud.alert.title.OFF_PLATFORM_PAYMENT',
    configJson: CONFIG_EXAMPLES.OFF_PLATFORM_PAYMENT,
  });

  const fetchRules = () => {
    setLoading(true);
    getFraudRules()
      .then(setRules)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRules(); }, []);

  const toggleEnabled = async (rule: FraudRule) => {
    try {
      const updated = await updateFraudRule(rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    }
  };

  const onRuleTypeChange = (ruleType: (typeof RULE_TYPES)[number]) => {
    setForm((prev) => ({
      ...prev,
      ruleType,
      i18nKey: `fraud.alert.title.${ruleType}`,
      configJson: CONFIG_EXAMPLES[ruleType],
    }));
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let config: Record<string, unknown> | undefined;
      if (form.configJson.trim()) {
        config = JSON.parse(form.configJson) as Record<string, unknown>;
      }
      const created = await createFraudRule({
        name: form.name,
        ruleType: form.ruleType,
        severity: form.severity,
        enabled: form.enabled,
        i18nKey: form.i18nKey,
        config,
      });
      setRules((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({
        name: '',
        ruleType: 'OFF_PLATFORM_PAYMENT',
        severity: 'MEDIUM',
        enabled: true,
        i18nKey: 'fraud.alert.title.OFF_PLATFORM_PAYMENT',
        configJson: CONFIG_EXAMPLES.OFF_PLATFORM_PAYMENT,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Loading rules...</p>;
  if (error && !showForm && rules.length === 0) return <ApiErrorState error={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Fraud Detection Rules</h1>
        <button
          onClick={() => { setShowForm(!showForm); setError(null); }}
          style={{ padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          {showForm ? 'Cancel' : '+ Add Rule'}
        </button>
      </div>

      {error && <div style={{ color: '#c62828', marginBottom: 12 }}>{error.message}</div>}

      {showForm && (
        <form
          onSubmit={onCreate}
          style={{
            background: 'white',
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>New Detection Rule</h2>
          <input
            placeholder="Rule name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={3}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <select
              value={form.ruleType}
              onChange={(e) => onRuleTypeChange(e.target.value as (typeof RULE_TYPES)[number])}
              style={inputStyle}
            >
              {RULE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              style={inputStyle}
            >
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="i18n key"
            value={form.i18nKey}
            onChange={(e) => setForm({ ...form, i18nKey: e.target.value })}
            required
            style={inputStyle}
          />
          <label style={{ fontSize: 14, color: '#555' }}>
            Config (JSON thresholds / patterns)
            <textarea
              value={form.configJson}
              onChange={(e) => setForm({ ...form, configJson: e.target.value })}
              rows={5}
              style={{ ...inputStyle, width: '100%', marginTop: 6, fontFamily: 'monospace' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled on create
          </label>
          <button type="submit" disabled={saving} style={{ padding: '10px 16px', cursor: 'pointer', alignSelf: 'flex-start' }}>
            {saving ? 'Creating…' : 'Create Rule'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.length === 0 && (
          <p style={{ color: '#666' }}>
            No rules yet. Add one above or run <code>npm run prisma:seed</code>.
          </p>
        )}
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
              {rule.config && (
                <pre style={{ fontSize: '11px', color: '#888', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(rule.config)}
                </pre>
              )}
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

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 14,
  flex: 1,
  minWidth: 160,
};
