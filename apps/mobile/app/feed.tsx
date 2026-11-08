import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Card, Muted, Button, Notice, Badge, Empty, Failed, Loading } from '../components/ui';
import { JobCard } from '../components/cards';
import { fetchFeed, fetchFeedSignals, hideFromFeed, type FeedReason } from '../api/seeker';
import { useTranslation } from '../lib/i18n';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';

/** "Jobs for you": the personalised feed, why each job is there, and "not interested". */
export default function Feed() {
  const { t } = useTranslation();
  const feed = useLoad(() => fetchFeed(10), []);
  const signals = useLoad(() => fetchFeedSignals().catch(() => null), []);
  const [error, setError] = useState('');

  const reasonText = (reason: FeedReason) => (reason.kind === 'saved' ? t('feed.reasons.saved') : t(`feed.reasons.${reason.kind}`, { terms: reason.terms.join(', ') }));

  async function hide(id: string) {
    const before = feed.data;
    feed.setData((list) => (list ?? []).filter((job) => job.id !== id));
    setError('');
    try {
      await hideFromFeed(id);
    } catch {
      if (before) feed.setData(before);
      setError(t('feed.hideFailed'));
    }
  }

  const jobs = feed.data ?? [];
  const fallback = signals.data !== undefined && signals.data !== null && (!signals.data.personalised || (jobs.length > 0 && jobs.every((job) => job.reasons.length === 0)));

  return (
    <Screen title={t('dash.jobsForYou')} refreshing={feed.refreshing} onRefresh={feed.refresh}>
      {signals.data ? (
        <Card>
          <Text className="text-sm font-bold text-ink-900 dark:text-white">{t('feed.matchOn')}</Text>
          {signals.data.skills.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {signals.data.skills.map((skill) => <Badge key={skill} label={skill} />)}
            </View>
          ) : <Muted>{t('feed.noSkills')}</Muted>}
          {signals.data.searches.length > 0 ? <Muted>{`${t('feed.recentSearches')}: ${signals.data.searches.join(', ')}`}</Muted> : null}
          <Button small variant="ghost" label={t('feed.editSkills')} onPress={() => router.push('/profile')} />
        </Card>
      ) : null}
      {fallback ? <Notice tone="info" text={`${t('feed.preferNot')} ${t('feed.preferNotText')}`} /> : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {feed.loading ? <Loading /> : feed.error ? <Failed message={errorText(feed.error, t)} onRetry={feed.reload} /> : jobs.length === 0 ? (
        <Empty title={t('feed.seenAll')} text={t('feed.seenAllText')} action={<Button small label={t('feed.searchAll')} onPress={() => router.push('/(tabs)/jobs')} />} />
      ) : null}
      {jobs.map((job) => (
        <View key={job.id} className="gap-2">
          <JobCard job={job} />
          {job.reasons.length > 0 ? (
            <View className="gap-1 px-1">
              <Text className="text-[13px] font-bold text-ink-700 dark:text-slate-300">{t('feed.why')}</Text>
              {job.reasons.map((reason) => <Muted key={`${reason.kind}-${reason.terms.join()}`}>• {reasonText(reason)}</Muted>)}
            </View>
          ) : null}
          <Button small variant="ghost" label={t('feed.hide')} onPress={() => hide(job.id)} />
        </View>
      ))}
    </Screen>
  );
}
