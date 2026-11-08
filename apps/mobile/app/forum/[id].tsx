import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThumbsUp } from 'lucide-react-native';
import { Screen, Card, H1, Body, Muted, Badge, Button, Field, Toggle, Notice, Failed, Loading } from '../../components/ui';
import { createReply, fetchThread, FORUM_LIMITS, upvoteReply, upvoteThread, type ForumReply } from '../../api/forum';
import { useAuth } from '../../store/auth.store';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useLoad } from '../../lib/use-load';
import { errorText } from '../../lib/api-error';
import { timeAgo } from '../../lib/format';

/** A forum thread with its replies; signed-in members reply (optionally anonymously) and upvote. */
export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const thread = useLoad(() => fetchThread(id), [id]);
  const [content, setContent] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<ForumReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [votes, setVotes] = useState<Record<string, number>>({});

  if (thread.loading) return <Screen title={t('forum.title')}><Loading /></Screen>;
  if (thread.error || !thread.data) return <Screen title={t('forum.title')}><Failed message={errorText(thread.error, t, 'forum.failed')} onRetry={thread.reload} /></Screen>;
  const data = thread.data;

  async function vote(kind: 'thread' | 'reply', targetId: string) {
    if (!user) return router.push({ pathname: '/(auth)/login', params: { next: `/forum/${id}` } });
    try {
      const result = kind === 'thread' ? await upvoteThread(targetId) : await upvoteReply(targetId);
      setVotes((current) => ({ ...current, [targetId]: result.upvoteCount }));
    } catch {
      // A failed vote just leaves the count as it was.
    }
  }

  async function reply() {
    const text = content.trim();
    if (text.length < 1) return;
    setBusy(true);
    setError('');
    try {
      await createReply(id, { content: text.slice(0, FORUM_LIMITS.MAX_CONTENT), parentReplyId: replyTo?.id, isAnonymous: anonymous });
      setContent('');
      setReplyTo(null);
      await thread.reload();
    } catch (failure) {
      setError(errorText(failure, t, 'forum.replyFailed'));
    } finally {
      setBusy(false);
    }
  }

  const renderReply = (item: ForumReply, depth = 0) => (
    <View key={item.id} style={{ marginLeft: depth * 16 }} className="gap-1.5 border-l-2 border-ink-200 pl-3 dark:border-slate-800">
      <Muted>{`${item.userDisplayName} · ${timeAgo(item.createdAt, locale)}`}</Muted>
      <Body>{item.content}</Body>
      <View className="flex-row gap-4">
        <Pressable onPress={() => vote('reply', item.id)} accessibilityRole="button" accessibilityLabel={t('forum.upvote')} className="min-h-9 flex-row items-center gap-1">
          <ThumbsUp color={colors.muted} size={14} />
          <Muted>{String(votes[item.id] ?? item.upvoteCount)}</Muted>
        </Pressable>
        {user && !data.isLocked ? (
          <Pressable onPress={() => setReplyTo(item)} accessibilityRole="button" className="min-h-9 justify-center">
            <Text className="text-[13px] font-bold text-forest dark:text-limeAccent">{t('forum.replyAction')}</Text>
          </Pressable>
        ) : null}
      </View>
      {(item.childReplies ?? []).map((child) => renderReply(child, Math.min(depth + 1, 3)))}
    </View>
  );

  return (
    <Screen title={t('forum.title')} refreshing={thread.refreshing} onRefresh={thread.refresh}>
      <View className="flex-row flex-wrap gap-2">
        {data.isPinned ? <Badge label={t('forum.pinned')} tone="info" /> : null}
        {data.isLocked ? <Badge label={t('forum.locked')} tone="warn" /> : null}
        {data.tags.map((tag) => <Badge key={tag} label={`#${tag}`} />)}
      </View>
      <H1>{data.title}</H1>
      <Muted>{`${data.userDisplayName} · ${timeAgo(data.createdAt, locale)}`}</Muted>
      <Body>{data.content}</Body>
      <Button small variant="outline" label={`${t('forum.upvote')} · ${votes[data.id] ?? data.upvoteCount}`} icon={<ThumbsUp color={colors.text} size={16} />} onPress={() => vote('thread', data.id)} />

      <Card>
        {data.replies.length === 0 ? <Muted>{t('forum.noReplies')}</Muted> : data.replies.filter((item) => !item.parentReplyId).map((item) => renderReply(item))}
      </Card>

      {data.isLocked ? (
        <Notice tone="warn" text={t('forum.lockedText')} />
      ) : user ? (
        <Card>
          {replyTo ? (
            <View className="flex-row items-center justify-between">
              <Muted>{t('forum.replyTo', { name: replyTo.userDisplayName })}</Muted>
              <Button small variant="ghost" label={t('forum.clear')} onPress={() => setReplyTo(null)} />
            </View>
          ) : null}
          <Field label={t('forum.yourReply')} value={content} onChangeText={setContent} multiline placeholder={t('forum.replyPlaceholder')} maxLength={FORUM_LIMITS.MAX_CONTENT} />
          <Toggle label={t('forum.replyAnon')} value={anonymous} onChange={setAnonymous} />
          {error ? <Notice tone="bad" text={error} /> : null}
          <Button label={t('forum.postReply')} busy={busy} disabled={!content.trim()} onPress={reply} />
        </Card>
      ) : (
        <Button label={t('forum.signIn')} onPress={() => router.push({ pathname: '/(auth)/login', params: { next: `/forum/${id}` } })} />
      )}
    </Screen>
  );
}
