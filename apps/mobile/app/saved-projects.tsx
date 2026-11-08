import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Empty, Failed, Loading, Button } from '../components/ui';
import { GigCard } from '../components/cards';
import { fetchSavedGigs } from '../api/freelance';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';

export default function SavedProjects() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const saved = useLoad(fetchSavedGigs, [], { refetchOnFocus: true });
  return (
    <Screen title={t('m.savedProjects')} scroll={false}>
      {saved.loading ? <Loading /> : saved.error ? (
        <View className="p-4"><Failed message={errorText(saved.error, t)} onRetry={saved.reload} /></View>
      ) : (
        <FlatList
          data={saved.data ?? []}
          keyExtractor={(gig) => gig.id}
          contentContainerClassName="gap-3 p-4 pb-10"
          renderItem={({ item }) => <GigCard gig={item} />}
          refreshControl={<RefreshControl refreshing={saved.refreshing} onRefresh={saved.refresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={<Empty title={t('m.noSavedProjects')} action={<Button small label={t('freelance.gig.browse')} onPress={() => router.push('/(tabs)/freelance')} />} />}
        />
      )}
    </Screen>
  );
}
