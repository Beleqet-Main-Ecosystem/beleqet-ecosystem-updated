import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Avatar, Empty, Failed, Loading, Muted } from '../../components/ui';
import { fetchRooms, type Room } from '../../api/chat';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { timeAgo } from '../../lib/format';

/** The other person in a room, and what the conversation is about. */
export function describeRoom(room: Room, myId: string | undefined) {
  const other = room.participants.map((p) => p.user).find((person) => person.id !== myId) ?? room.participants[0]?.user;
  const name = other ? `${other.firstName} ${other.lastName}`.trim() : '';
  const about = room.contract?.freelanceJob?.title ?? room.job?.title ?? null;
  return { other, name, about };
}

export default function Messages() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const me = useAuth((s) => s.user);
  const rooms = useLoad(fetchRooms, [], { refetchOnFocus: true });

  return (
    <Screen title={t('m.tabs.messages')} back={false} scroll={false}>
      {rooms.loading ? <Loading /> : rooms.error ? (
        <View className="p-4"><Failed message={errorText(rooms.error, t)} onRetry={rooms.reload} /></View>
      ) : (
        <FlatList
          data={rooms.data ?? []}
          keyExtractor={(room) => room.id}
          contentContainerClassName="p-4 pb-10"
          refreshControl={<RefreshControl refreshing={rooms.refreshing} onRefresh={rooms.refresh} tintColor={colors.accent} colors={[colors.accent]} />}
          ListEmptyComponent={<Empty title={t('chat.empty')} text={t('chat.emptyText')} />}
          ItemSeparatorComponent={() => <View className="h-px bg-ink-200 dark:bg-slate-800" />}
          renderItem={({ item }) => {
            const { name, about } = describeRoom(item, me?.id);
            const last = item.messages[item.messages.length - 1] ?? item.messages[0];
            return (
              <Pressable onPress={() => router.push(`/chat/${item.id}`)} accessibilityRole="button" className="flex-row items-center gap-3 py-3 active:opacity-70">
                <Avatar name={name} />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className={`flex-1 text-[15px] text-ink-900 dark:text-white ${item.unread ? 'font-extrabold' : 'font-bold'}`} numberOfLines={1}>{name}</Text>
                    {last ? <Muted>{timeAgo(last.createdAt, locale)}</Muted> : null}
                  </View>
                  {about ? <Text className="text-[13px] font-semibold text-forest dark:text-limeAccent" numberOfLines={1}>{about}</Text> : null}
                  {last ? <Text className={`text-sm ${item.unread ? 'font-semibold text-ink-900 dark:text-white' : 'text-ink-500 dark:text-slate-400'}`} numberOfLines={1}>{last.content}</Text> : null}
                </View>
                {item.unread ? <View className="h-2.5 w-2.5 rounded-full bg-forest dark:bg-limeAccent" /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}
