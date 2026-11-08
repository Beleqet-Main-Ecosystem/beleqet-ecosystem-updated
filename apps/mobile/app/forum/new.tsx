import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { Screen, Card, Field, Button, Toggle, Notice, Muted } from '../../components/ui';
import { createThread, FORUM_LIMITS } from '../../api/forum';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { errorText } from '../../lib/api-error';

/** Start a discussion: title, details, up to 10 tags, optionally anonymous. Same limits as the website. */
export default function NewThread() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function addTag() {
    const tag = tagDraft.trim().toLowerCase().replace(/^#/, '').slice(0, FORUM_LIMITS.MAX_TAG);
    if (tag && !tags.includes(tag) && tags.length < FORUM_LIMITS.MAX_TAGS) setTags([...tags, tag]);
    setTagDraft('');
  }

  async function post() {
    if (title.trim().length < FORUM_LIMITS.MIN_TITLE) return setError(t('forum.errTitle'));
    if (content.trim().length < FORUM_LIMITS.MIN_CONTENT) return setError(t('forum.errContent'));
    setBusy(true);
    setError('');
    try {
      const thread = await createThread({ title: title.trim(), content: content.trim(), tags, isAnonymous: anonymous });
      router.replace(`/forum/${thread.id}`);
    } catch (failure) {
      setError(errorText(failure, t, 'forum.postFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t('forum.start')} footer={<Button label={t('forum.start')} busy={busy} onPress={post} />}>
      <Card>
        <Field label={t('forum.titleLabel')} value={title} onChangeText={setTitle} placeholder={t('forum.titlePlaceholder')} hint={t('forum.titleHint')} maxLength={FORUM_LIMITS.MAX_TITLE} />
        <Field label={t('forum.details')} value={content} onChangeText={setContent} multiline placeholder={t('forum.detailsPlaceholder')} hint={t('forum.detailsHint')} maxLength={FORUM_LIMITS.MAX_CONTENT} />
        <View className="gap-1.5">
          <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('forum.tagsLabel')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {tags.map((tag) => (
              <Pressable key={tag} onPress={() => setTags(tags.filter((item) => item !== tag))} accessibilityRole="button" accessibilityLabel={t('forum.removeTag')} className="flex-row items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 dark:bg-slate-800">
                <Text className="text-[13px] font-semibold text-ink-800 dark:text-slate-100">#{tag}</Text>
                <X color={colors.muted} size={14} />
              </Pressable>
            ))}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1"><Field value={tagDraft} onChangeText={setTagDraft} onSubmitEditing={addTag} autoCapitalize="none" returnKeyType="done" /></View>
            <Button label={t('forum.addTag')} variant="outline" onPress={addTag} />
          </View>
        </View>
        <Toggle label={t('forum.postAnon')} hint={t('forum.postAnonText')} value={anonymous} onChange={setAnonymous} />
      </Card>
      <Muted>{t('forum.rules')}</Muted>
      {error ? <Notice tone="bad" text={error} /> : null}
    </Screen>
  );
}
