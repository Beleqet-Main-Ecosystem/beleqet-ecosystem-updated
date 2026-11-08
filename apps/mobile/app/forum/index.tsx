import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MessageSquare, Pin, Plus, ThumbsUp } from 'lucide-react-native';
import { Screen, Field, Chips, Card, Muted, Badge } from '../../components/ui';
import { PagedList } from '../../components/paged-list';
import { fetchThreads, type ForumThread } from '../../api/forum';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { timeAgo } from '../../lib/format';

const SORTS = ['latest', 'popular', 'unanswered'] as const;
const RULES = ['respect', 'private', 'scams'] as const;

export default function Forum() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string>('latest');
  const [tag, setTag] = useState('');

  const header = (
    <View className="gap-3 pb-1">
      <Muted>{t('forum.sub')}</Muted>
      <Field value={draft} onChangeText={setDraft} placeholder={t('forum.search')} returnKeyType="search" onSubmitEditing={() => setSearch(draft.trim())} />
      <Chips value={sort} onChange={setSort} options={SORTS.map((value) => ({ value, label: t(`forum.sort.${value}`) }))} />
      {tag ? (
        <Pressable onPress={() => setTag('')} accessibilityRole="button" className="self-start">
          <Badge label={`#${tag} ✕`} tone="info" />
        </Pressable>
      ) : null}
      <Card>
        <Text className="text-sm font-bold text-ink-900 dark:text-white">{t('forum.rules')}</Text>
        {RULES.map((rule) => <Muted key={rule}>• {t(`forum.rule.${rule}`)}</Muted>)}
      </Card>
    </View>
  );

  return (
    <Screen
      title={t('forum.title')}
      scroll={false}
      right={
        <Pressable
          onPress={() => (user ? router.push('/forum/new') : router.push({ pathname: '/(auth)/login', params: { next: '/forum/new' } }))}
          accessibilityRole="button"
          accessibilityLabel={t('forum.start')}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <Plus color="#fff" size={24} />
        </Pressable>
      }
    >
      <PagedList
        query={JSON.stringify({ search, sort, tag })}
        load={async (page) => {
          const result = await fetchThreads({ page, limit: 20, sort, search, tag });
          return { items: result.items, page: result.pagination.page, totalPages: result.pagination.totalPages, total: result.pagination.total };
        }}
        render={(thread) => <ThreadRow thread={thread} onTag={setTag} />}
        keyOf={(thread) => thread.id}
        header={header}
        emptyTitle={t('forum.none')}
      />
    </Screen>
  );
}

function ThreadRow({ thread, onTag }: { thread: ForumThread; onTag: (tag: string) => void }) {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/forum/${thread.id}`)} accessibilityRole="button" className="gap-2 rounded-xl border border-ink-200 bg-surface p-4 active:opacity-80 dark:border-slate-800 dark:bg-slate-900">
      <View className="flex-row items-center gap-2">
        {thread.isPinned ? <Pin color={colors.accent} size={14} /> : null}
        <Text className="flex-1 text-base font-bold text-ink-900 dark:text-white" numberOfLines={2}>{thread.title}</Text>
      </View>
      <Text className="text-sm text-ink-600 dark:text-slate-300" numberOfLines={2}>{thread.content}</Text>
      {thread.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {thread.tags.map((tag) => (
            <Pressable key={tag} onPress={() => onTag(tag)} accessibilityRole="button">
              <Badge label={`#${tag}`} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View className="flex-row items-center gap-4">
        <Muted>{`${thread.userDisplayName} · ${timeAgo(thread.createdAt, locale)}`}</Muted>
        <View className="ml-auto flex-row items-center gap-1"><ThumbsUp color={colors.muted} size={14} /><Muted>{String(thread.upvoteCount)}</Muted></View>
        <View className="flex-row items-center gap-1"><MessageSquare color={colors.muted} size={14} /><Muted>{String(thread.replyCount)}</Muted></View>
      </View>
    </Pressable>
  );
}
