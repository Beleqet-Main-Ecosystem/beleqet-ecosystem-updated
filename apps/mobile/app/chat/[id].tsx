import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { Screen, Failed, Loading, Muted, Notice } from '../../components/ui';
import { fetchMessages, fetchRooms, markRoomRead, useChatSocket, type ChatMessage } from '../../api/chat';
import { describeRoom } from '../(tabs)/messages';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { dateTime } from '../../lib/format';

const MAX_LENGTH = 2000;

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const me = useAuth((s) => s.user);
  const history = useLoad(() => fetchMessages(id), [id]);
  const room = useLoad(() => fetchRooms().then((rooms) => rooms.find((r) => r.id === id) ?? null), [id]);
  const { socket, state } = useChatSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (history.data) setMessages(history.data);
    markRoomRead(id).catch(() => undefined);
  }, [history.data, id]);

  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit('join_room', { roomId: id });
    const onMessage = (message: ChatMessage) => {
      if (message.roomId !== id) return;
      setMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      markRoomRead(id).catch(() => undefined);
    };
    const onError = () => setError(t('chat.sendFailed'));
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('new_message', onMessage);
    socket.on('error', onError);
    return () => {
      socket.off('connect', join);
      socket.off('new_message', onMessage);
      socket.off('error', onError);
    };
  }, [socket, id, t]);

  function sendMessage() {
    const content = draft.trim();
    if (!content || !socket || state !== 'connected') return;
    setError('');
    socket.emit('send_message', { roomId: id, content: content.slice(0, MAX_LENGTH) });
    setDraft('');
  }

  const { name, about } = room.data ? describeRoom(room.data, me?.id) : { name: '', about: null };

  return (
    <Screen
      title={name || t('m.tabs.messages')}
      scroll={false}
      footer={
        <>
        {state !== 'connected' ? <Muted>{t('chat.connecting')}</Muted> : null}
        {error ? <Notice tone="bad" text={error} /> : null}
        <View className="flex-row items-end gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.write')}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={MAX_LENGTH}
            className="max-h-32 min-h-12 flex-1 rounded-2xl border border-ink-300 bg-surface px-4 py-3 text-base text-ink-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim() || state !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            className={`h-12 w-12 items-center justify-center rounded-full bg-obsidian dark:bg-limeAccent ${!draft.trim() || state !== 'connected' ? 'opacity-50' : ''}`}
          >
            <Send color={colors.onAccent} size={20} />
          </Pressable>
        </View>
        </>
      }
    >
      {about ? (
        <View className="border-b border-ink-200 bg-surface px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
          <Text className="text-[13px] font-semibold text-forest dark:text-limeAccent" numberOfLines={1}>{about}</Text>
        </View>
      ) : null}
      {history.loading ? <Loading /> : history.error ? (
        <View className="p-4"><Failed message={errorText(history.error, t)} onRetry={history.reload} /></View>
      ) : (
        <FlatList
          ref={list}
          className="flex-1"
          data={messages}
          keyExtractor={(message) => message.id}
          contentContainerClassName="gap-2 p-4"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Muted className="text-center">{t('chat.startText')}</Muted>}
          renderItem={({ item }) => {
            const mine = item.senderId === me?.id;
            return (
              <View className={`max-w-[82%] gap-1 rounded-2xl px-3.5 py-2.5 ${mine ? 'self-end rounded-br-md bg-obsidian dark:bg-limeAccent' : 'self-start rounded-bl-md bg-surface dark:bg-slate-800'}`}>
                <Text className={`text-[15px] leading-5 ${mine ? 'text-white dark:text-obsidian' : 'text-ink-900 dark:text-white'}`}>{item.content}</Text>
                <Text className={`text-[11px] ${mine ? 'text-white/60 dark:text-obsidian/60' : 'text-ink-400'}`}>{dateTime(item.createdAt, locale)}</Text>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
