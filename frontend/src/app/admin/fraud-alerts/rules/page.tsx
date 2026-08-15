'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, X } from 'lucide-react';
import type { FraudRule } from '@/types/fraud';
import { createFraudRule, getFraudRules, updateFraudRule } from '@/lib/api';
import { ApiErrorState } from '@/components/fraud/ApiErrorState';

const RULE_TYPES = [
  'OFF_PLATFORM_PAYMENT',
  'FAKE_PROFILE',
  'PAYMENT_ANOMALY',
  'DUPLICATE_LISTING',
] as const;

const CONFIG_EXAMPLES: Record<string, string> = {
  OFF_PLATFORM_PAYMENT: JSON.stringify(
    { threshold: 30, patterns: ['phone', 'email', 'telebirr'] },
    null,
    2,
  ),
  FAKE_PROFILE: JSON.stringify(
    { maxUnverifiedSkills: 8, requireEmailVerification: true },
    null,
    2,
  ),
  PAYMENT_ANOMALY: JSON.stringify({ zScoreThreshold: 2.5, minimumHistory: 3 }, null, 2),
  DUPLICATE_LISTING: JSON.stringify({ similarityThreshold: 0.8, lookbackDays: 30 }, null, 2),
};

const BLANK_FORM = {
  name: '',
  ruleType: 'OFF_PLATFORM_PAYMENT' as (typeof RULE_TYPES)[number],
  severity: 'MEDIUM',
  enabled: true,
  i18nKey: 'fraud.alert.title.OFF_PLATFORM_PAYMENT',
  configJson: CONFIG_EXAMPLES.OFF_PLATFORM_PAYMENT,
};

export default function FraudRulesPage() {
  const [rules, setRules] = useState<FraudRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<(Error & { status?: number }) | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const loadRules = () => {
    setLoading(true);
    getFraudRules()
      .then(setRules)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRules();
  }, []);

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
      setForm(BLANK_FORM);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (loading && rules.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-gray-400">Loading rules…</p>
      </div>
    );
  }

  if (error && !showForm && rules.length === 0) return <ApiErrorState error={error} />;

  return (
    <div className="px-6 py-8 max-w-3xl">
      <Link
        href="/admin/fraud-alerts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Fraud Alerts
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fraud Detection Rules</h1>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setError(null);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" aria-hidden="true" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add Rule
            </>
          )}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error.message}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={onCreate}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="text-base font-semibold text-gray-800">New Detection Rule</h2>

          <input
            placeholder="Rule name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <div className="flex flex-wrap gap-3">
            <select
              value={form.ruleType}
              onChange={(e) => onRuleTypeChange(e.target.value as (typeof RULE_TYPES)[number])}
              className="flex-1 min-w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {RULE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <input
            placeholder="i18n key"
            value={form.i18nKey}
            onChange={(e) => setForm({ ...form, i18nKey: e.target.value })}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Config (JSON thresholds / patterns)
            </label>
            <textarea
              value={form.configJson}
              onChange={(e) => setForm({ ...form, configJson: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="rounded"
            />
            Enable on create
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Rule'}
          </button>
        </form>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-sm text-gray-400">
            No rules yet. Add one above or run{' '}
            <code className="font-mono text-xs">npm run prisma:seed</code>.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex-1 min-w-48">
                <p className="font-semibold text-gray-800">{rule.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {rule.ruleType.replace(/_/g, ' ')} · {rule.severity}
                </p>
                {rule.config && (
                  <pre className="mt-1 text-xs text-gray-400 whitespace-pre-wrap">
                    {JSON.stringify(rule.config)}
                  </pre>
                )}
              </div>
              <button
                onClick={() => void toggleEnabled(rule)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  rule.enabled
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
