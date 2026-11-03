'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from '@/lib/i18n';
import { JOB_TYPES, type JobTypeCode } from '@/features/jobs/search-params';
import { apiGet, apiSend } from '../api';
import { card, Field, input, muted, outline, solid, Toggle } from '../ui';

type Alert = {
  id: string;
  keywords: string[];
  location: string | null;
  jobType: JobTypeCode | null;
  minSalary: number | null;
  isActive: boolean;
};

/** Emails when a new job matches: keywords, place, type and minimum pay. */
export default function JobAlerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState<JobTypeCode | ''>('');
  const [minSalary, setMinSalary] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<Alert[]>('/job-alerts').then(setAlerts).catch(() => setAlerts([]));
  }, []);
  useEffect(load, [load]);

  function describe(alert: Alert) {
    return [
      alert.location,
      alert.jobType && t(`search.types.${alert.jobType}`),
      alert.minSalary && t('dash.alerts.from').replace('{amount}', `ETB ${alert.minSalary.toLocaleString('en-US')}`),
    ]
      .filter(Boolean)
      .join(' · ');
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const words = keywords.split(',').map((word) => word.trim()).filter(Boolean);
    if (!words.length && !location.trim() && !jobType && !minSalary) {
      setError(t('dash.alerts.needOne'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const alert = await apiSend<Alert>('POST', '/job-alerts', {
        keywords: words,
        location: location.trim() || undefined,
        jobType: jobType || undefined,
        minSalary: Number(minSalary) || undefined,
      });
      setAlerts((list) => [alert, ...(list ?? [])]);
      setAdding(false);
      setKeywords('');
      setLocation('');
      setJobType('');
      setMinSalary('');
    } catch {
      setError(t('dash.alerts.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(alert: Alert) {
    setAlerts((list) => list && list.map((item) => (item.id === alert.id ? { ...item, isActive: !item.isActive } : item)));
    try {
      await apiSend('PATCH', `/job-alerts/${alert.id}`, { isActive: !alert.isActive });
    } catch {
      setAlerts((list) => list && list.map((item) => (item.id === alert.id ? alert : item)));
      setError(t('dash.saveFailed'));
    }
  }

  async function remove(alert: Alert) {
    setError('');
    try {
      await apiSend('DELETE', `/job-alerts/${alert.id}`);
      setAlerts((list) => list && list.filter((item) => item.id !== alert.id));
    } catch {
      setError(t('dash.saveFailed'));
    }
  }

  return (
    <section className={`${card} flex flex-col gap-3`} aria-labelledby="alerts-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="alerts-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.alerts.title')}</h2>
        {!adding && <button type="button" onClick={() => setAdding(true)} className={outline}>+ {t('dash.alerts.new')}</button>}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}

      {adding && (
        <form noValidate onSubmit={create} className="flex flex-col gap-3 rounded-lg border border-ink-200 p-4 dark:border-slate-800">
          <Field label={t('dash.alerts.keywords')}>
            <input type="text" value={keywords} placeholder={t('dash.alerts.keywordsHint')} onChange={(e) => setKeywords(e.target.value)} className={input} />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t('search.location')}>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={input} />
            </Field>
            <Field label={t('search.jobType')}>
              <select value={jobType} onChange={(e) => setJobType(e.target.value as JobTypeCode | '')} className={input}>
                <option value="">{t('dash.alerts.anyType')}</option>
                {JOB_TYPES.map((code) => <option key={code} value={code}>{t(`search.types.${code}`)}</option>)}
              </select>
            </Field>
            <Field label={t('dash.alerts.minSalary')}>
              <input type="number" min={0} inputMode="numeric" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} className={input} />
            </Field>
          </div>
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={solid}>{t(busy ? 'postJob.saving' : 'dash.alerts.create')}</button>
            <button type="button" onClick={() => setAdding(false)} className={outline}>{t('postJob.cancel')}</button>
          </span>
        </form>
      )}

      {alerts === null ? null : alerts.length === 0 && !adding ? (
        <p className={muted}>{t('dash.alerts.none')}</p>
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F4F6] pt-3 dark:border-slate-800">
            <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <b className="text-[15px] text-ink-900 dark:text-white">{alert.keywords.join(', ') || t('dash.alerts.anyJob')}</b>
              {describe(alert) && <span className={muted}>{describe(alert)}</span>}
            </span>
            <span className="flex items-center gap-2">
              <Toggle on={alert.isActive} label={t('dash.alerts.toggle').replace('{name}', alert.keywords.join(', ') || t('dash.alerts.anyJob'))} onChange={() => toggle(alert)} />
              <button type="button" onClick={() => remove(alert)} className="min-h-10 px-2 text-sm font-semibold text-[#B42318] dark:text-red-300">{t('dash.alerts.delete')}</button>
            </span>
          </div>
        ))
      )}
    </section>
  );
}
