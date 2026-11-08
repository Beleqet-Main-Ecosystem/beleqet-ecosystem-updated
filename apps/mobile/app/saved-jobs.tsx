import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Empty, Failed, Loading, Button } from '../components/ui';
import { JobCard } from '../components/cards';
import { fetchSavedJobs, unsaveJob } from '../api/jobs';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';

export default function SavedJobs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const saved = useLoad(fetchSavedJobs, [], { refetchOnFocus: true });

  async function remove(jobId: string) {
    saved.setData((rows) => (rows ?? []).filter((row) => row.jobId !== jobId));
    await unsaveJob(jobId).catch(() => saved.reload());
  }

  return (
    <Screen title={t('dash.tabs.saved')} scroll={false}>
      {saved.loading ? <Loading /> : saved.error ? (
        <View className="p-4"><Failed message={errorText(saved.error, t)} onRetry={saved.reload} /></View>
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(row) => row.id}
          contentContainerClassName="gap-3 p-4 pb-10"
          refreshControl={<RefreshControl refreshing={saved.refreshing} onRefresh={saved.refresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={<Empty title={t('dash.noSaved')} text={t('dash.noSavedText')} action={<Button small label={t('dash.browse')} onPress={() => router.push('/(tabs)/jobs')} />} />}
          renderItem={({ item }) => (
            <View className="gap-2">
              <JobCard job={item.job} />
              <Button small variant="ghost" label={t('m.unsave')} onPress={() => remove(item.jobId)} />
            </View>
          )}
        />
      )}
    </Screen>
  );
}
