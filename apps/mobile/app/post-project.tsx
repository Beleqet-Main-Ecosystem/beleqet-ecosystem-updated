import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileText, X } from 'lucide-react-native';
import { Screen, Card, H1, H2, Muted, Field, Select, Chips, Button, Notice, Fact, Badge, Progress, Loading, Failed } from '../components/ui';
import { createGig, fetchGigCategories } from '../api/freelance';
import { uploadFile, type PickedFile } from '../lib/api';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { formatBudget } from '../lib/format';

const STEPS = ['describe', 'budget', 'review'] as const;
const LEVELS = ['Entry', 'Intermediate', 'Expert'] as const;
const FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_DESCRIPTION = 30;
const NEXT_STEPS = ['bids', 'accept', 'fund', 'approve'] as const;

/** Post a freelance project in three steps, like the website's PostProject. */
export default function PostProject() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const categories = useLoad(fetchGigCategories, []);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [pricing, setPricing] = useState<'FIXED' | 'HOURLY'>('FIXED');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [days, setDays] = useState('');
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('Intermediate');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishedId, setPublishedId] = useState('');

  if (!user) {
    return (
      <Screen title={t('dash.postProject')}>
        <Button label={t('auth.signIn')} onPress={() => router.replace({ pathname: '/(auth)/login', params: { next: '/post-project' } })} />
      </Screen>
    );
  }
  if (categories.loading) return <Screen title={t('dash.postProject')}><Loading /></Screen>;
  if (categories.error) return <Screen title={t('dash.postProject')}><Failed message={errorText(categories.error, t)} onRetry={categories.reload} /></Screen>;

  const min = Number(budgetMin);
  const max = Number(budgetMax);
  const budget = min >= 1 && max >= min ? `${formatBudget({ budgetMin: min, budgetMax: max, currency: 'ETB' })}${pricing === 'HOURLY' ? ` / ${t('freelance.hour')}` : ''}` : '';
  const category = (categories.data ?? []).find((item) => item.id === categoryId);

  if (publishedId) {
    return (
      <Screen title={t('dash.postProject')}>
        <Card>
          <CheckCircle2 color={colors.accent} size={32} />
          <H1>{t('freelance.post2.liveTitle')}</H1>
          <Muted>{t('freelance.post2.liveText')}</Muted>
          <Button label={t('freelance.post2.view')} onPress={() => router.replace(`/gig/${publishedId}`)} />
          <Button label={t('m.tabs.projects')} variant="outline" onPress={() => router.replace('/(tabs)/projects')} />
        </Card>
      </Screen>
    );
  }

  function addSkill() {
    const skill = skillDraft.trim().replace(/,$/, '');
    if (skill && !skills.some((item) => item.toLowerCase() === skill.toLowerCase())) setSkills([...skills, skill]);
    setSkillDraft('');
  }

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    if (result.assets.some((asset) => (asset.size ?? 0) > MAX_FILE_BYTES)) return setError(t('freelance.post2.fileTooBig'));
    setError('');
    setFiles([...files, ...result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }))]);
  }

  function stepError(): string {
    if (step === 0) {
      if (title.trim().length < 5) return t('freelance.post2.errTitle');
      if (!categoryId) return t('freelance.post2.errCategory');
      if (description.trim().length < MIN_DESCRIPTION) return t('freelance.post2.errDescription');
      if (skills.length === 0 && !skillDraft.trim()) return t('freelance.post2.errSkills');
    }
    if (step === 1) {
      if (!budget) return t('freelance.post2.errBudget');
      if (!(Number(days) >= 1)) return t('freelance.post2.errDays');
    }
    return '';
  }

  async function next() {
    if (skillDraft.trim()) addSkill();
    const problem = stepError();
    setError(problem);
    if (problem) return;
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const attachments = await Promise.all(files.map(uploadFile));
      const gig = await createGig({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        budgetMin: min,
        budgetMax: max,
        pricingType: pricing,
        deadlineDays: Math.round(Number(days)),
        skills,
        experienceLevel: level,
        locationPreference: location.trim() || undefined,
        attachments,
      });
      setPublishedId(gig.id);
    } catch (failure) {
      setError(errorText(failure, t, 'freelance.post2.publishFailed'));
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <View className="flex-row gap-3">
      {step > 0 ? <Button className="flex-1" variant="outline" label={t('freelance.post2.back')} onPress={() => { setError(''); setStep(step - 1); }} /> : null}
      <Button className="flex-1" label={step < 2 ? t('auth.continue') : t('m.publishProject')} onPress={next} busy={busy} />
    </View>
  );

  return (
    <Screen title={t('dash.postProject')} footer={footer}>
      <View className="gap-2">
        <Muted>{`${step + 1} / 3 · ${t(`freelance.post2.steps.${STEPS[step]}`)}`}</Muted>
        <Progress value={((step + 1) / 3) * 100} />
        <H1>{t(`freelance.post2.heading.${STEPS[step]}`)}</H1>
        {STEPS[step] !== 'review' ? <Muted>{t(`freelance.post2.sub.${STEPS[step]}`)}</Muted> : null}
      </View>

      {step === 0 ? (
        <Card>
          <Field label={t('freelance.post2.titleLabel')} value={title} onChangeText={setTitle} hint={t('freelance.post2.titleHint')} />
          <Select label={t('freelance.post2.category')} value={categoryId} onChange={setCategoryId} placeholder={t('freelance.post2.chooseCategory')} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.label }))} />
          <Field label={t('freelance.post2.description')} value={description} onChangeText={setDescription} multiline hint={t('freelance.post2.descriptionHint')} />
          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.post2.skills')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {skills.map((skill) => (
                <Pressable key={skill} onPress={() => setSkills(skills.filter((item) => item !== skill))} accessibilityRole="button" accessibilityLabel={t('freelance.post2.removeSkill')} className="flex-row items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 dark:bg-slate-800">
                  <Text className="text-[13px] font-semibold text-ink-800 dark:text-slate-100">{skill}</Text>
                  <X color={colors.muted} size={14} />
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1"><Field value={skillDraft} onChangeText={setSkillDraft} onSubmitEditing={addSkill} returnKeyType="done" placeholder={t('freelance.post2.addSkill')} /></View>
              <Button label={t('dash.add')} variant="outline" onPress={addSkill} />
            </View>
          </View>
          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-ink-900 dark:text-white">{`${t('freelance.gig.attachments')} (${t('freelance.post2.optional')})`}</Text>
            {files.map((file, index) => (
              <View key={`${file.uri}-${index}`} className="flex-row items-center gap-2">
                <FileText color={colors.accent} size={18} />
                <Text className="flex-1 text-sm text-ink-800 dark:text-slate-200" numberOfLines={1}>{file.name}</Text>
                <Pressable onPress={() => setFiles(files.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={t('freelance.post2.removeFile')} className="h-9 w-9 items-center justify-center">
                  <X color={colors.muted} size={16} />
                </Pressable>
              </View>
            ))}
            <Button small variant="outline" label={t('freelance.post2.browse')} onPress={pickFiles} />
            <Muted>{t('freelance.post2.fileHint')}</Muted>
          </View>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('freelance.post2.howPay')}</Text>
          <Chips value={pricing} onChange={(value) => setPricing(value as 'FIXED' | 'HOURLY')} options={[{ value: 'FIXED', label: t('freelance.fixed') }, { value: 'HOURLY', label: t('freelance.hourly') }]} />
          <Muted>{t(pricing === 'FIXED' ? 'freelance.post2.fixedHint' : 'freelance.post2.hourlyHint')}</Muted>
          <View className="flex-row gap-3">
            <View className="flex-1"><Field label={t('freelance.post2.minimum')} value={budgetMin} onChangeText={(value) => setBudgetMin(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
            <View className="flex-1"><Field label={t('freelance.post2.maximum')} value={budgetMax} onChangeText={(value) => setBudgetMax(value.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          </View>
          <Field label={t('freelance.post2.neededDays')} value={days} onChangeText={(value) => setDays(value.replace(/\D/g, ''))} keyboardType="number-pad" />
          <Select label={t('freelance.gig.experience')} value={level} onChange={(value) => setLevel(value as (typeof LEVELS)[number])} options={LEVELS.map((option) => ({ value: option, label: t(`freelance.post2.levels.${option}`) }))} />
          <Field label={`${t('freelance.post2.location')} (${t('freelance.post2.optional')})`} value={location} onChangeText={setLocation} />
        </Card>
      ) : null}

      {step === 2 ? (
        <>
          <Card>
            <H2>{title.trim()}</H2>
            <View className="flex-row flex-wrap gap-2">
              {category ? <Badge label={category.label} tone="info" /> : null}
              <Badge label={t(pricing === 'HOURLY' ? 'freelance.hourly' : 'freelance.fixed')} />
            </View>
            <Fact label={t('freelance.post2.previewBudget')} value={budget} />
            <Fact label={t('freelance.post2.neededWithin')} value={t('freelance.gig.days', { days: Number(days) })} />
            <Fact label={t('freelance.gig.experience')} value={t(`freelance.post2.levels.${level}`)} />
            <Muted>{description.trim()}</Muted>
            <View className="flex-row flex-wrap gap-2">
              {skills.map((skill) => <Badge key={skill} label={skill} />)}
            </View>
          </Card>
          <Card>
            <H2>{t('freelance.post2.nextTitle')}</H2>
            {NEXT_STEPS.map((item, index) => <Muted key={item}>{`${index + 1}. ${t(`freelance.post2.next.${item}`)}`}</Muted>)}
          </Card>
          <Muted>{t('freelance.post2.freeNote')}</Muted>
        </>
      ) : null}
      {error ? <Notice tone="bad" text={error} /> : null}
    </Screen>
  );
}
