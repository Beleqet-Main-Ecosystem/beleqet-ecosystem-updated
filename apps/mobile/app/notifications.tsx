import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Screen, Empty, Failed, Loading, Muted } from '../components/ui';
import { fetchNotifications, markAllRead, markRead, type AppNotification } from '../api/notifications';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { timeAgo } from '../lib/format';
import { refreshUnread } from '../lib/unread';

/** Where a notification leads, from what its metadata names. Same rules as the API's pushPath. */
function pathOf(item: AppNotification): string | null {
  const m = item.metadata ?? {};
  const id = (key: string) => (typeof m[key] === 'string' && m[key] ? encodeURIComponent(m[key] as string) : null);
  if (typeof m.path === 'string' && m.path.startsWith('/') && !m.path.startsWith('//')) return m.path;
  if (id('contractId')) return `/contract/${id('contractId')}`;
  if (id('roomId')) return `/chat/${id('roomId')}`;
  if (id('freelanceJobId')) return `/gig/${id('freelanceJobId')}`;
  if (id('gigId')) return `/gig/${id('gigId')}`;
  if (id('applicationId')) return '/applications';
  if (id('interviewId')) return '/interviews';
  if (id('paymentId')) return '/plan';
  if (id('jobId')) return `/job/${id('jobId')}`;
  return null;
}

export default function Notifications() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const items = useLoad(fetchNotifications, []);
  const unread = (items.data ?? []).filter((item) => !item.read).length;

  async function open(item: AppNotification) {
    if (!item.read) {
      items.setData((list) => (list ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      await markRead(item.id).catch(() => undefined);
      void refreshUnread();
    }
    const path = pathOf(item);
    if (path) router.push(path as Href);
  }

  async function readAll() {
    items.setData((list) => (list ?? []).map((n) => ({ ...n, read: true })));
    await markAllRead().catch(() => undefined);
    void refreshUnread();
  }

  return (
    <Screen
      title={t('m.notifications')}
      scroll={false}
      right={
        unread > 0 ? (
          <Pressable onPress={readAll} accessibilityRole="button" className="min-h-11 justify-center px-3">
            <Text className="text-sm font-bold text-limeAccent">{t('m.markAllRead')}</Text>
          </Pressable>
        ) : null
      }
    >
      {items.loading ? <Loading /> : items.error ? (
        <View className="p-4"><Failed message={errorText(items.error, t)} onRetry={items.reload} /></View>
      ) : (
        <FlatList
          data={items.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4 pb-10"
          refreshControl={<RefreshControl refreshing={items.refreshing} onRefresh={items.refresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={<Empty title={t('m.noNotifications')} />}
          ItemSeparatorComponent={() => <View className="h-px bg-ink-200 dark:bg-slate-800" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item)} accessibilityRole="button" className={`flex-row gap-3 py-3.5 ${item.read ? 'opacity-60' : ''}`}>
              <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${item.read ? 'bg-transparent' : 'bg-forest dark:bg-limeAccent'}`} />
              <View className="flex-1 gap-1">
                <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{item.title}</Text>
                <Text className="text-sm leading-5 text-ink-700 dark:text-slate-300">{item.body}</Text>
                <Muted>{timeAgo(item.createdAt, locale)}</Muted>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
