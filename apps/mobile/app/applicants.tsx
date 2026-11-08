import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Card, Muted, Body, Badge, Button, Select, Notice, Empty, Failed, Loading, Avatar } from '../components/ui';
import { autoSchedule, fetchApplicants, fetchMyJobs, moveApplicant, STAGES, type Applicant } from '../api/employer';
import type { ApplicationStatus } from '../api/seeker';
import { startChat } from '../api/chat';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { safeHttpUrl, shortDate } from '../lib/format';

/** Applicants for one of the employer's jobs: pipeline counts, CVs, stage changes, interviews. */
export default function Applicants() {
  const params = useLocalSearchParams<{ job?: string }>();
  const { t, locale } = useTranslation();
  const jobs = useLoad(fetchMyJobs, []);
  const [picked, setPicked] = useState<string | undefined>(params.job);
  const list = (jobs.data ?? []).filter((job) => job.status !== 'ARCHIVED');
  const job = list.find((item) => item.id === picked) ?? list[0];
  const rows = useLoad(() => fetchApplicants(job!.id), [job?.id], { enabled: Boolean(job), refetchOnFocus: true });
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  if (jobs.loading) return <Screen title={t('emp.tabs.applicants')}><Loading /></Screen>;
  if (jobs.error) return <Screen title={t('emp.tabs.applicants')}><Failed message={errorText(jobs.error, t)} onRetry={jobs.reload} /></Screen>;
  if (!job) {
    return (
      <Screen title={t('emp.tabs.applicants')}>
        <Empty title={t('emp.noJobs')} action={<Button small label={t('postJob.title')} onPress={() => router.push('/post-job')} />} />
      </Screen>
    );
  }

  async function move(row: Applicant, status: ApplicationStatus) {
    setError('');
    setNote('');
    try {
      await moveApplicant(row.id, status);
      rows.setData((current) => (current ?? []).map((item) => (item.id === row.id ? { ...item, status } : item)));
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.gig.actionFailed'));
    }
  }

  async function schedule(row: Applicant) {
    setError('');
    setNote('');
    try {
      await autoSchedule(row.id);
      setNote(t('emp.scheduled'));
      await rows.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'emp.scheduleFailed'));
    }
  }

  async function message(row: Applicant) {
    try {
      const room = await startChat(row.user.id);
      router.push(`/chat/${room.id}`);
    } catch (failure) {
      setError(errorText(failure, t, 'chat.startFailed'));
    }
  }

  return (
    <Screen title={t('emp.tabs.applicants')} refreshing={rows.refreshing} onRefresh={rows.refresh}>
      <Select label={t('emp.applicantsFor')} value={job.id} onChange={setPicked} options={list.map((item) => ({ value: item.id, label: item.title }))} />
      {rows.data ? (
        <View className="flex-row flex-wrap gap-2">
          {STAGES.map((stage) => (
            <View key={stage} className="min-w-[30%] flex-1 rounded-lg border border-ink-200 bg-surface p-2.5 dark:border-slate-800 dark:bg-slate-900">
              <Text className="text-xl font-bold text-ink-900 dark:text-white">{rows.data!.filter((row) => row.status === stage).length}</Text>
              <Text className="text-xs text-ink-500 dark:text-slate-400" numberOfLines={1}>{t(`dash.status.${stage}`)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {note ? <Notice tone="good" text={note} /> : null}
      {rows.loading ? <Loading /> : rows.error ? <Failed message={errorText(rows.error, t)} onRetry={rows.reload} /> : rows.data?.length === 0 ? <Empty title={t('emp.noApplicants')} text={t('emp.noApplicantsText')} /> : null}
      {rows.data?.map((row) => {
        const name = `${row.user.firstName} ${row.user.lastName}`;
        const cv = safeHttpUrl(row.resumeUrl);
        const portfolio = safeHttpUrl(row.portfolioUrl);
        return (
          <Card key={row.id}>
            <View className="flex-row items-start gap-3">
              <Avatar name={name} />
              <View className="flex-1 gap-0.5">
                <Text className="font-bold text-ink-900 dark:text-white">{name}</Text>
                <Muted>{[row.user.email, shortDate(row.createdAt, locale)].join(' · ')}</Muted>
                {row.expectedSalary ? <Muted>{t('emp.expects', { amount: `ETB ${row.expectedSalary.toLocaleString('en-US')}` })}</Muted> : null}
              </View>
              {row.score ? <Badge label={t('emp.match', { score: Math.round(row.score.overallScore) })} tone="good" /> : null}
            </View>
            {row.user.skills && row.user.skills.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {row.user.skills.slice(0, 8).map((skill) => <Badge key={skill} label={skill} />)}
              </View>
            ) : null}
            {row.coverLetter ? <Body>{row.coverLetter}</Body> : null}
            <View className="flex-row flex-wrap gap-2">
              {cv ? <Button small variant="outline" label="CV" onPress={() => Linking.openURL(cv)} /> : null}
              {portfolio ? <Button small variant="outline" label={t('job.apply.portfolio')} onPress={() => Linking.openURL(portfolio)} /> : null}
              <Button small variant="outline" label={t('emp.message')} onPress={() => message(row)} />
              {row.status === 'SHORTLISTED' ? <Button small variant="outline" label={t('emp.autoSchedule')} onPress={() => schedule(row)} /> : null}
            </View>
            <Select
              label={t('emp.stageFor', { name })}
              value={row.status}
              onChange={(value) => move(row, value as ApplicationStatus)}
              options={[...(row.status === 'WITHDRAWN' ? [{ value: 'WITHDRAWN', label: t('dash.status.WITHDRAWN') }] : []), ...STAGES.map((stage) => ({ value: stage, label: t(`dash.status.${stage}`) }))]}
            />
          </Card>
        );
      })}
      {rows.data && rows.data.length > 0 ? <Muted>{t('emp.notified')}</Muted> : null}
    </Screen>
  );
}
