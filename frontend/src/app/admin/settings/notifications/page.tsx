'use client';
import { useCallback, useEffect, useState } from 'react';
import { Settings, Save, CheckCircle2 } from 'lucide-react';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/api';
import type { NotificationPreference } from '@/types';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic' },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(key: keyof Pick<NotificationPreference, 'emailEnabled' | 'telegramEnabled' | 'inAppEnabled' | 'pushEnabled' | 'smsEnabled'>) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: !prefs[key] });
  }

  async function handleSave() {
    if (!prefs) return;
    try {
      setSaving(true);
      setSaved(false);
      const updated = await updateNotificationPreferences({
        emailEnabled: prefs.emailEnabled,
        telegramEnabled: prefs.telegramEnabled,
        inAppEnabled: prefs.inAppEnabled,
        pushEnabled: prefs.pushEnabled,
        smsEnabled: prefs.smsEnabled,
        language: prefs.language,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  function handleLanguageChange(lang: string) {
    if (!prefs) return;
    setPrefs({ ...prefs, language: lang });
  }

  if (loading) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Notification Settings</h1>
            <p className="page-header-subtitle">Manage how you receive notifications</p>
          </div>
        </div>
        <div className="page-body">
          <div className="loading-spinner">
            <div className="spinner" />
            <span>Loading settings…</span>
          </div>
        </div>
      </>
    );
  }

  const channels = [
    { key: 'inAppEnabled' as const, label: 'In-App Notifications', desc: 'Show notifications inside the app' },
    { key: 'emailEnabled' as const, label: 'Email Notifications', desc: 'Receive notifications via email' },
    { key: 'telegramEnabled' as const, label: 'Telegram Notifications', desc: 'Receive notifications via Telegram bot' },
    { key: 'pushEnabled' as const, label: 'Push Notifications', desc: 'Receive browser push notifications' },
    { key: 'smsEnabled' as const, label: 'SMS Notifications', desc: 'Receive notifications via SMS' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Notification Settings</h1>
          <p className="page-header-subtitle">Manage how you receive notifications</p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><div className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 size={16} /> Saved</>
          ) : (
            <><Save size={16} /> Save changes</>
          )}
        </button>
      </div>

      <div className="page-body">
        {error && (
          <div className="error-msg" style={{ marginBottom: 24 }}>
            {error}
          </div>
        )}

        {/* Notification Channels */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="notif-settings-section-header">
            <Settings size={18} />
            <h2>Notification Channels</h2>
          </div>
          <p className="notif-settings-section-desc">
            Choose which channels you want to receive notifications on.
          </p>

          <div className="notif-channels-list">
            {channels.map((ch) => (
              <div key={ch.key} className="notif-channel-row">
                <div className="notif-channel-info">
                  <span className="notif-channel-label">{ch.label}</span>
                  <span className="notif-channel-desc">{ch.desc}</span>
                </div>
                <button
                  type="button"
                  className={`notif-toggle ${prefs?.[ch.key] ? 'notif-toggle--on' : ''}`}
                  onClick={() => toggle(ch.key)}
                  aria-label={`Toggle ${ch.label}`}
                >
                  <span className="notif-toggle-thumb" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Language Preference */}
        <div className="card">
          <div className="notif-settings-section-header">
            <h2>Notification Language</h2>
          </div>
          <p className="notif-settings-section-desc">
            Select the language for email and in-app notification text.
          </p>

          <div className="notif-language-options">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                className={`notif-lang-btn ${prefs?.language === lang.value ? 'notif-lang-btn--active' : ''}`}
                onClick={() => handleLanguageChange(lang.value)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
