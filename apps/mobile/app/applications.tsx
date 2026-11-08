import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Button, Chips, Notice } from '../components/ui';
import { RowList } from '../components/row-list';
import { fetchApplications, withdrawApplication, type Application } from '../api/seeker';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { shortDate } from '../lib/format';

const STEPS = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED'] as const;
const CLOSED = ['REJECTED', 'WITHDRAWN'];
/** The only statuses the API lets a candidate withdraw from. */
const CAN_WITHDRAW = ['SUBMITTED', 'SCREENING', 'SHORTLISTED'];
const FILTERS = ['all', 'active', 'interview', 'closed'] as const;

export default function Applications() {
  const { t, locale } = useTranslation();
  const apps = useLoad(fetchApplications, [], { refetchOnFocus: true });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [error, setError] = useState('');

  const shown = (apps.data ?? []).filter((app) => {
    if (filter === 'active') return !CLOSED.includes(app.status);
    if (filter === 'interview') return app.status === 'INTERVIEW_SCHEDULED';
    if (filter === 'closed') return CLOSED.includes(app.status);
    return true;
  });

  function confirmWithdraw(app: Application) {
    Alert.alert(t('dash.withdrawTitle'), t('dash.withdrawText'), [
      { text: t('dash.keepIt'), style: 'cancel' },
      {
        text: t('dash.withdraw'),
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await withdrawApplication(app.id);
            apps.setData((list) => (list ?? []).map((item) => (item.id === app.id ? { ...item, status: 'WITHDRAWN' } : item)));
          } catch (failure) {
            setError(errorText(failure, t, 'freelance.gig.actionFailed'));
          }
        },
      },
    ]);
  }

  const rows = shown.map((app) => {
    const step = STEPS.indexOf(app.status as (typeof STEPS)[number]);
    return {
      id: app.id,
      title: app.job.title,
      detail: [app.job.company?.name, `${t('dash.applied')} ${shortDate(app.createdAt, locale)}`].filter(Boolean).join(' · '),
      status: t(`dash.status.${app.status}`),
      tone: (app.status === 'OFFERED' ? 'good' : CLOSED.includes(app.status) ? 'bad' : app.status === 'INTERVIEW_SCHEDULED' ? 'info' : 'neutral') as 'good' | 'bad' | 'info' | 'neutral',
      onPress: () => router.push(`/job/${app.jobId}`),
      extra: (
        <View className="gap-2">
          {step >= 0 ? (
            <View className="flex-row gap-1" accessibilityLabel={t(`dash.status.${app.status}`)}>
              {STEPS.map((s, index) => (
                <View key={s} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-forest dark:bg-limeAccent' : 'bg-ink-200 dark:bg-slate-800'}`} />
              ))}
            </View>
          ) : null}
          {CAN_WITHDRAW.includes(app.status) ? <Button small variant="outline" label={t('dash.withdraw')} onPress={() => confirmWithdraw(app)} /> : null}
        </View>
      ),
    };
  });

  return (
    <Screen title={t('dash.appsTitle')} scroll={false}>
      <RowList
        rows={rows}
        loading={apps.loading}
        error={apps.error}
        refreshing={apps.refreshing}
        onRetry={apps.reload}
        onRefresh={apps.refresh}
        emptyTitle={t('dash.nothing')}
        emptyText={t('dash.nothingText')}
        emptyAction={<Button small label={t('dash.browse')} onPress={() => router.push('/(tabs)/jobs')} />}
        header={
          <View className="gap-3 pb-1">
            <Chips value={filter} onChange={(value) => setFilter(value as typeof filter)} options={FILTERS.map((item) => ({ value: item, label: t(`dash.filters.${item}`) }))} />
            {error ? <Notice tone="bad" text={error} /> : null}
          </View>
        }
      />
    </Screen>
  );
}
