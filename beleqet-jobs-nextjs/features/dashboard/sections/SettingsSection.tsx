'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend, fetchProfile } from '../api';
import { card, Confirm, Failed, Field, Heading, input, link, muted, outline, shortDate, Toggle } from '../ui';
import TwoStep from './TwoStep';
import JobAlerts from './JobAlerts';
import DeleteAccount from './DeleteAccount';
import { errorText } from '@/lib/api-error';

type Prefs = { emailEnabled: boolean; telegramEnabled: boolean; inAppEnabled: boolean };
type Subscription = { id: string; status: string; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null; plan?: { name?: string } | null };

const CHANNELS = ['emailEnabled', 'telegramEnabled', 'inAppEnabled'] as const;

export default function SettingsSection() {
  const { t, locale, setLocale } = useTranslation();
  const { preference, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedOn, setFeedOn] = useState<boolean | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Prefs>('/users/notification-preferences').then(setPrefs).catch(() => setFailed(true));
    apiGet<Subscription | null>('/subscriptions/me').then(setSubscription).catch(() => setSubscription(null));
    fetchProfile().then((profile) => setFeedOn(profile.gdprConsent)).catch(() => setFeedOn(null));
  }, []);

  async function toggleFeed() {
    const next = !feedOn;
    setFeedOn(next);
    setError('');
    try {
      await apiSend('PATCH', '/users/profile', { gdprConsent: next });
    } catch {
      setFeedOn(!next);
      setError(t('dash.saveFailed'));
    }
  }
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!prefs) return <div className="min-h-[40vh]" />;

  async function toggle(channel: (typeof CHANNELS)[number]) {
    const next = { ...prefs!, [channel]: !prefs![channel] };
    setPrefs(next);
    setError('');
    try {
      await apiSend('PATCH', '/users/notification-preferences', { [channel]: next[channel] });
    } catch {
      setPrefs(prefs);
      setError(t('dash.saveFailed'));
    }
  }

  async function cancelPlan() {
    setBusy(true);
    setError('');
    try {
      await apiSend('POST', `/subscriptions/${subscription!.id}/cancel`);
      setSubscription({ ...subscription!, cancelAtPeriodEnd: true });
    } catch (problem) {
      setError(errorText(problem, t, 'freelance.gig.actionFailed'));
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  }

  const title = 'text-lg font-bold text-ink-900 dark:text-white';
  const active = subscription && !subscription.cancelAtPeriodEnd && subscription.status === 'ACTIVE';

  return (
    <>
      <Heading title={t('dash.tabs.settings')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

      <JobAlerts />

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={title}>{t('dash.reachYou')}</h2>
        {CHANNELS.map((channel) => (
          <div key={channel} className="flex items-center justify-between gap-3 border-t border-[#F1F4F6] pt-3 dark:border-slate-800">
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">{t(`dash.channels.${channel}.name`)}</b>
              <span className={muted}>{t(`dash.channels.${channel}.detail`)}</span>
            </span>
            <Toggle on={prefs[channel]} label={t(`dash.channels.${channel}.name`)} onChange={() => toggle(channel)} />
          </div>
        ))}
      </section>

      <section className={`${card} flex flex-col gap-4`}>
        <h2 className={title}>{t('dash.display')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('dash.language')}>
            <select value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className={input}>
              <option value="en">English</option>
              <option value="am">አማርኛ</option>
            </select>
          </Field>
          <Field label={t('dash.theme')}>
            <select value={preference} onChange={(event) => setTheme(event.target.value as typeof preference)} className={input}>
              <option value="system">{t('dash.themeSystem')}</option>
              <option value="light">{t('dash.themeLight')}</option>
              <option value="dark">{t('dash.themeDark')}</option>
            </select>
          </Field>
        </div>
        {feedOn !== null && (
          <div className="flex items-center justify-between gap-3 border-t border-[#F1F4F6] pt-3 dark:border-slate-800">
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">{t('dash.feedToggle')}</b>
              <span className={muted}>{t('dash.feedToggleText')}</span>
            </span>
            <Toggle on={feedOn} label={t('dash.feedToggle')} onChange={toggleFeed} />
          </div>
        )}
      </section>

      <TwoStep />

      <section className={`${card} flex flex-col gap-3`}>
        <h2 className={title}>{t('dash.planTitle')}</h2>
        {subscription ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">{subscription.plan?.name}</b>
              {subscription.currentPeriodEnd && (
                <span className={muted}>
                  {t(active ? 'dash.renews' : 'dash.ends').replace('{date}', shortDate(subscription.currentPeriodEnd, locale))}
                </span>
              )}
            </span>
            {active && <button type="button" onClick={() => setCancelling(true)} className={outline}>{t('dash.cancelPlan')}</button>}
          </div>
        ) : (
          <p className="text-sm text-ink-700 dark:text-slate-300">
            {t('dash.freePlan')} <Link href="/pricing" className={link}>{t('dash.seePlans')}</Link>
          </p>
        )}
      </section>

      <DeleteAccount />

      {cancelling && (
        <Confirm
          title={t('dash.cancelTitle')}
          text={t('dash.cancelText')}
          cancel={t('dash.keepPlan')}
          confirm={t('dash.cancelPlan')}
          busy={busy}
          onCancel={() => setCancelling(false)}
          onConfirm={cancelPlan}
        />
      )}
    </>
  );
}
