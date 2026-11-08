import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen, Card, Muted, Field, Select, Button, Notice, Toggle, Empty, Failed, Loading } from '../components/ui';
import { createAlert, deleteAlert, fetchAlerts, setAlertActive, type JobAlert } from '../api/seeker';
import { JOB_TYPES } from '../api/jobs';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';

/** Emails when a new job matches: keywords, place, type and minimum pay. Same as the website. */
export default function Alerts() {
  const { t } = useTranslation();
  const alerts = useLoad(fetchAlerts, []);
  const [adding, setAdding] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const describe = (alert: JobAlert) =>
    [alert.location, alert.jobType ? t(`search.types.${alert.jobType}`) : null, alert.minSalary ? t('dash.alerts.from', { amount: `ETB ${alert.minSalary.toLocaleString('en-US')}` }) : null]
      .filter(Boolean)
      .join(' · ');

  async function create() {
    const words = keywords.split(',').map((word) => word.trim()).filter(Boolean);
    if (!words.length && !location.trim() && !jobType && !minSalary) return setError(t('dash.alerts.needOne'));
    setBusy(true);
    setError('');
    try {
      const alert = await createAlert({ keywords: words, location: location.trim() || undefined, jobType: jobType || undefined, minSalary: Number(minSalary) || undefined });
      alerts.setData((list) => [alert, ...(list ?? [])]);
      setAdding(false);
      setKeywords('');
      setLocation('');
      setJobType('');
      setMinSalary('');
    } catch (failure) {
      setError(errorText(failure, t, 'dash.alerts.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(alert: JobAlert) {
    alerts.setData((list) => (list ?? []).map((item) => (item.id === alert.id ? { ...item, isActive: !item.isActive } : item)));
    try {
      await setAlertActive(alert.id, !alert.isActive);
    } catch {
      alerts.setData((list) => (list ?? []).map((item) => (item.id === alert.id ? alert : item)));
      setError(t('dash.saveFailed'));
    }
  }

  async function remove(alert: JobAlert) {
    setError('');
    try {
      await deleteAlert(alert.id);
      alerts.setData((list) => (list ?? []).filter((item) => item.id !== alert.id));
    } catch (failure) {
      setError(errorText(failure, t, 'dash.saveFailed'));
    }
  }

  return (
    <Screen title={t('dash.alerts.title')} refreshing={alerts.refreshing} onRefresh={alerts.refresh}>
      {error ? <Notice tone="bad" text={error} /> : null}
      {!adding ? <Button label={`+ ${t('dash.alerts.new')}`} variant="outline" onPress={() => setAdding(true)} /> : (
        <Card>
          <Field label={t('dash.alerts.keywords')} value={keywords} onChangeText={setKeywords} hint={t('dash.alerts.keywordsHint')} />
          <Field label={t('m.location')} value={location} onChangeText={setLocation} />
          <Select label={t('m.jobTypeLabel')} value={jobType} onChange={setJobType} options={[{ value: '', label: t('dash.alerts.anyType') }, ...JOB_TYPES.map((type) => ({ value: type, label: t(`search.types.${type}`) }))]} />
          <Field label={t('dash.alerts.minSalary')} value={minSalary} onChangeText={(value) => setMinSalary(value.replace(/\D/g, ''))} keyboardType="number-pad" />
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="outline" label={t('postJob.cancel')} onPress={() => setAdding(false)} />
            <Button className="flex-1" label={t('postJob.save')} busy={busy} onPress={create} />
          </View>
        </Card>
      )}
      {alerts.loading ? <Loading /> : alerts.error ? <Failed message={errorText(alerts.error, t)} onRetry={alerts.reload} /> : (alerts.data ?? []).length === 0 ? <Empty title={t('dash.alerts.none')} /> : null}
      {(alerts.data ?? []).map((alert) => (
        <Card key={alert.id}>
          <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{alert.keywords.join(', ') || t('dash.alerts.anyJob')}</Text>
          {describe(alert) ? <Muted>{describe(alert)}</Muted> : null}
          <Toggle label={t('dash.alerts.toggle')} value={alert.isActive} onChange={() => toggle(alert)} />
          <Button small variant="ghost" label={t('dash.alerts.delete')} onPress={() => remove(alert)} />
        </Card>
      ))}
    </Screen>
  );
}
