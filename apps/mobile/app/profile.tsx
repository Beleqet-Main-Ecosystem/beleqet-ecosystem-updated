import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { X } from 'lucide-react-native';
import { Screen, Card, H2, Muted, Field, Button, Notice, Failed, Loading, Avatar, DateTimeField, Badge } from '../components/ui';
import { fetchProfile, updateProfile, type Profile } from '../api/seeker';
import { addSlot, fetchSlots, removeSlot, type Slot } from '../api/interviews';
import { uploadFile } from '../lib/api';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText } from '../lib/api-error';
import { dateTime, safeHttpUrl } from '../lib/format';

const TEXT_FIELDS = ['firstName', 'lastName', 'headline', 'location', 'phone'] as const;
const LINK_FIELDS = ['linkedinUrl', 'portfolioUrl', 'githubUrl'] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const CV_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** Profile & CV, as on the website: photo, details, skills, links, CV, and interview availability. */
export default function ProfileScreen() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const refreshUser = useAuth((s) => s.refreshUser);
  const load = useLoad(() => Promise.all([fetchProfile(), fetchSlots().catch(() => [] as Slot[])]), []);
  // Edits on top of what loaded.
  const [edited, setProfile] = useState<Profile | null>(null);
  const [editedSlots, setSlots] = useState<Slot[] | null>(null);
  const profile = edited ?? load.data?.[0] ?? null;
  const slots = editedSlots ?? load.data?.[1] ?? [];
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'photo' | 'cv'>('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slotError, setSlotError] = useState('');

  if (load.loading || (!profile && !load.error)) return <Screen title={t('dash.profileTitle')}><Loading /></Screen>;
  if (load.error || !profile) return <Screen title={t('dash.profileTitle')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;

  const change = (patch: Partial<Profile>) => {
    setSaved(false);
    setProfile({ ...profile, ...patch });
  };

  function addSkill() {
    const value = skill.trim();
    if (value && !profile!.skills.includes(value)) change({ skills: [...profile!.skills, value] });
    setSkill('');
  }

  async function save() {
    setError('');
    setSaved(false);
    if (LINK_FIELDS.some((field) => profile![field] && !safeHttpUrl(profile![field]))) return setError(t('job.apply.portfolioInvalid'));
    setBusy('save');
    try {
      const body: Record<string, unknown> = { skills: profile!.skills, bio: profile!.bio ?? '' };
      for (const field of TEXT_FIELDS) body[field] = profile![field] ?? '';
      for (const field of LINK_FIELDS) body[field] = profile![field] ? safeHttpUrl(profile![field]) : '';
      await updateProfile(body as Partial<Profile>);
      setSaved(true);
      await refreshUser();
    } catch (failure) {
      setError(errorText(failure, t, 'dash.saveFailed'));
    } finally {
      setBusy('');
    }
  }

  async function setPhoto(avatarUrl: string | null) {
    await updateProfile({ avatarUrl: avatarUrl ?? '' } as Partial<Profile>);
    change({ avatarUrl });
    await refreshUser();
  }

  async function pickPhoto() {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize ?? 0) > MAX_BYTES) return setError(t('emp.fileTooBig'));
    setBusy('photo');
    try {
      const url = await uploadFile({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' });
      await setPhoto(url);
    } catch (failure) {
      setError(errorText(failure, t, 'emp.uploadFailed'));
    } finally {
      setBusy('');
    }
  }

  async function pickCv() {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: CV_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > MAX_BYTES) return setError(t('job.apply.errSize'));
    setBusy('cv');
    try {
      const url = await uploadFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
      await updateProfile({ defaultResumeUrl: url } as Partial<Profile>);
      change({ defaultResumeUrl: url });
    } catch (failure) {
      setError(errorText(failure, t, 'emp.uploadFailed'));
    } finally {
      setBusy('');
    }
  }

  async function newSlot() {
    setSlotError('');
    if (!start || !end || new Date(end) <= new Date(start)) return setSlotError(t('dash.errSlot'));
    try {
      const slot = await addSlot(new Date(start).toISOString(), new Date(end).toISOString());
      setSlots([...slots, slot]);
      setStart('');
      setEnd('');
    } catch (failure) {
      setSlotError(errorText(failure, t, 'freelance.gig.actionFailed'));
    }
  }

  async function dropSlot(id: string) {
    setSlotError('');
    try {
      await removeSlot(id);
      setSlots(slots.filter((slot) => slot.id !== id));
    } catch (failure) {
      setSlotError(errorText(failure, t, 'freelance.gig.actionFailed'));
    }
  }

  const photo = safeHttpUrl(profile.avatarUrl);
  const cv = safeHttpUrl(profile.defaultResumeUrl);

  return (
    <Screen title={t('dash.profileTitle')} footer={<Button label={busy === 'save' ? t('auth.saving') : t('postJob.save')} onPress={save} busy={busy === 'save'} />}>
      <Muted>{t('dash.profileSub')}</Muted>
      {error ? <Notice tone="bad" text={error} /> : null}
      {saved ? <Notice tone="good" text={t('dash.saved')} /> : null}

      <Card>
        <View className="flex-row items-center gap-4">
          {photo ? <Image source={{ uri: photo }} className="h-16 w-16 rounded-full" accessibilityIgnoresInvertColors /> : <Avatar name={`${profile.firstName} ${profile.lastName}`} size={64} />}
          <View className="flex-1 gap-2">
            <Muted>{t('dash.photoText')}</Muted>
            <View className="flex-row gap-2">
              <Button small variant="outline" label={t('m.profile.changePhoto')} busy={busy === 'photo'} onPress={pickPhoto} />
              {photo ? <Button small variant="ghost" label={t('dash.removePhoto')} onPress={() => setPhoto(null).catch((failure) => setError(errorText(failure, t, 'dash.saveFailed')))} /> : null}
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <H2>{t('dash.aboutYou')}</H2>
        {TEXT_FIELDS.map((field) => (
          <Field
            key={field}
            label={t(`dash.fields.${field}`)}
            value={profile[field] ?? ''}
            onChangeText={(value) => change({ [field]: value } as Partial<Profile>)}
            keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
            autoComplete={field === 'phone' ? 'tel' : field === 'firstName' ? 'given-name' : field === 'lastName' ? 'family-name' : 'off'}
          />
        ))}
        <Field label={t('dash.fields.bio')} value={profile.bio ?? ''} onChangeText={(bio) => change({ bio })} multiline />
      </Card>

      <Card>
        <H2>{t('postJob.skills')}</H2>
        <View className="flex-row flex-wrap gap-2">
          {profile.skills.map((item) => (
            <Pressable key={item} onPress={() => change({ skills: profile.skills.filter((s) => s !== item) })} accessibilityRole="button" accessibilityLabel={`${t('dash.remove')} ${item}`} className="flex-row items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 dark:bg-slate-800">
              <Text className="text-[13px] font-semibold text-ink-800 dark:text-slate-100">{item}</Text>
              <X color={colors.muted} size={14} />
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1"><Field value={skill} onChangeText={setSkill} placeholder={t('m.profile.addSkill')} onSubmitEditing={addSkill} returnKeyType="done" /></View>
          <Button label={t('dash.add')} variant="outline" onPress={addSkill} />
        </View>
      </Card>

      <Card>
        <H2>{t('dash.links')}</H2>
        {LINK_FIELDS.map((field) => (
          <Field key={field} label={t(`dash.fields.${field}`)} value={profile[field] ?? ''} onChangeText={(value) => change({ [field]: value } as Partial<Profile>)} autoCapitalize="none" keyboardType="url" placeholder="https://" />
        ))}
      </Card>

      <Card>
        <H2>{t('dash.yourCv')}</H2>
        {cv ? <Button small variant="outline" label={t('dash.viewCv')} onPress={() => Linking.openURL(cv)} /> : <Muted>{t('dash.noCv')}</Muted>}
        <Button small label={t('m.profile.uploadCv')} busy={busy === 'cv'} onPress={pickCv} />
        <View className="flex-row gap-2">
          <Button className="flex-1" small variant="ghost" label={t('dash.openBrain')} onPress={() => router.push('/resume-brain')} />
          <Button className="flex-1" small variant="ghost" label={t('dash.openCvMaker')} onPress={() => router.push('/cv-maker')} />
        </View>
      </Card>

      <Card>
        <H2>{t('dash.availability')}</H2>
        <Muted>{t('dash.availabilitySub')}</Muted>
        {slots.map((slot) => (
          <View key={slot.id} className="flex-row items-center gap-2 border-t border-ink-100 pt-2 dark:border-slate-800">
            <Text className="flex-1 text-sm text-ink-800 dark:text-slate-200">{`${dateTime(slot.startTime, locale)} – ${dateTime(slot.endTime, locale)}`}</Text>
            {slot.booked ? <Badge label={t('m.profile.booked')} tone="info" /> : <Button small variant="ghost" label={t('dash.remove')} onPress={() => dropSlot(slot.id)} />}
          </View>
        ))}
        <DateTimeField label={t('dash.from')} value={start} onChange={setStart} minimumDate={new Date()} />
        <DateTimeField label={t('dash.to')} value={end} onChange={setEnd} minimumDate={start ? new Date(start) : new Date()} />
        {slotError ? <Notice tone="bad" text={slotError} /> : null}
        <Button small variant="outline" label={t('dash.addTime')} onPress={newSlot} />
      </Card>
    </Screen>
  );
}
