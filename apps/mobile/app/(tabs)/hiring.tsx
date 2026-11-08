import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { Screen, Button, Chips, Notice } from '../../components/ui';
import { RowList } from '../../components/row-list';
import { VerifyEmailBanner } from '../../components/verify-banner';
import { fetchMyJobs, setJobStatus, type EmployerJob, type JobStatus } from '../../api/employer';
import { useTranslation } from '../../lib/i18n';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { daysUntil, shortDate } from '../../lib/format';

const FILTERS = ['all', 'PUBLISHED', 'DRAFT', 'CLOSED'] as const;

/** The employer's jobs: filter by state, see applicants, edit, close, publish or reopen. */
export default function Hiring() {
  const { t, locale } = useTranslation();
  const jobs = useLoad(fetchMyJobs, [], { refetchOnFocus: true });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [error, setError] = useState('');

  const list = (jobs.data ?? []).filter((job) => job.status !== 'ARCHIVED');
  const shown = filter === 'all' ? list : list.filter((job) => job.status === filter);

  async function setStatus(job: EmployerJob, status: JobStatus, filled?: boolean) {
    setError('');
    try {
      await setJobStatus(job.id, status, filled);
      jobs.setData((rows) => (rows ?? []).map((row) => (row.id === job.id ? { ...row, status } : row)));
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.gig.actionFailed'));
    }
  }

  function close(job: EmployerJob) {
    Alert.alert(t('emp.closeTitle'), t('emp.closeText'), [
      { text: t('postJob.cancel'), style: 'cancel' },
      { text: t('emp.closeNotHired'), onPress: () => void setStatus(job, 'CLOSED', false) },
      { text: t('emp.closeHired'), onPress: () => void setStatus(job, 'CLOSED', true) },
    ]);
  }

  const rows = shown.map((job) => {
    const left = daysUntil(job.deadline);
    return {
      id: job.id,
      title: job.title,
      detail: [job.location, t('emp.applicantCount', { count: job._count?.applications ?? 0 }), job.deadline ? t('emp.closes', { date: shortDate(job.deadline, locale) }) : null].filter(Boolean).join(' · '),
      status: t(`emp.filters.${job.status}`),
      tone: (job.status === 'PUBLISHED' ? 'good' : job.status === 'CLOSED' ? 'neutral' : 'warn') as 'good' | 'neutral' | 'warn',
      onPress: () => router.push({ pathname: '/applicants', params: { job: job.id } }),
      extra: (
        <View className="gap-2">
          {left !== null && left < 0 && job.status === 'PUBLISHED' ? <Notice tone="warn" text={t('emp.pastDeadline')} /> : null}
          <View className="flex-row flex-wrap gap-2">
            <Button small variant="outline" label={t('emp.edit')} onPress={() => router.push({ pathname: '/post-job', params: { edit: job.id } })} />
            {job.status === 'PUBLISHED' ? <Button small variant="outline" label={t('emp.close')} onPress={() => close(job)} /> : null}
            {job.status === 'DRAFT' ? <Button small label={t('emp.publish')} onPress={() => setStatus(job, 'PUBLISHED')} /> : null}
            {job.status === 'CLOSED' ? <Button small variant="outline" label={t('emp.reopen')} onPress={() => setStatus(job, 'PUBLISHED')} /> : null}
            <Button small variant="ghost" label={t('m.viewPost')} onPress={() => router.push(`/job/${job.id}`)} />
          </View>
        </View>
      ),
    };
  });

  return (
    <Screen
      title={t('m.tabs.hiring')}
      back={false}
      scroll={false}
      right={
        <Pressable onPress={() => router.push('/post-job')} accessibilityRole="button" accessibilityLabel={t('postJob.title')} className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <Plus color="#fff" size={24} />
        </Pressable>
      }
    >
      <RowList
        rows={rows}
        loading={jobs.loading}
        error={jobs.error}
        refreshing={jobs.refreshing}
        onRetry={jobs.reload}
        onRefresh={jobs.refresh}
        emptyTitle={list.length === 0 ? t('emp.noOpen') : t('emp.noJobs')}
        emptyText={list.length === 0 ? t('emp.noOpenText') : undefined}
        emptyAction={list.length === 0 ? <Button small label={t('postJob.title')} onPress={() => router.push('/post-job')} /> : undefined}
        header={
          <View className="gap-3 pb-1">
            <VerifyEmailBanner />
            <Chips
              value={filter}
              onChange={(value) => setFilter(value as typeof filter)}
              options={FILTERS.map((item) => ({ value: item, label: `${t(`emp.filters.${item}`)} (${item === 'all' ? list.length : list.filter((job) => job.status === item).length})` }))}
            />
            <View className="flex-row gap-2">
              <Button className="flex-1" small variant="outline" label={t('emp.tabs.applicants')} onPress={() => router.push('/applicants')} />
              <Button className="flex-1" small variant="outline" label={t('emp.interviewsTitle')} onPress={() => router.push('/interviews')} />
            </View>
            {error ? <Notice tone="bad" text={error} /> : null}
          </View>
        }
      />
    </Screen>
  );
}
