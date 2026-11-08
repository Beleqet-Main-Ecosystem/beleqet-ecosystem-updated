import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText, X } from 'lucide-react-native';
import { Screen, Card, H1, H2, Muted, Field, Button, Notice, Badge } from '../components/ui';
import { autofillProfile, deleteResume, readResume, type PersonalInfo, type UploadResumeResponse } from '../api/resume';
import { useCvImport } from '../lib/cv-import';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { errorText } from '../lib/api-error';
import type { PickedFile } from '../lib/api';

const ACCEPTED = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_MB = 10;
const FIELDS = ['fullName', 'email', 'phone', 'location'] as const;

/** Upload a CV, check what was read, and fill the profile with it. Same steps as the website. */
export default function ResumeBrain() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const setImport = useCvImport((s) => s.set);
  const [step, setStep] = useState<'upload' | 'reading' | 'review' | 'done'>('upload');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<UploadResumeResponse | null>(null);
  const [info, setInfo] = useState<PersonalInfo>({ fullName: '', email: '', phone: '', location: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const attempt = useRef(0);

  async function pick() {
    setError('');
    const picked = await DocumentPicker.getDocumentAsync({ type: ACCEPTED, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if (asset.mimeType && !ACCEPTED.includes(asset.mimeType)) return setError(t('resumeBrain.wrongType'));
    if ((asset.size ?? 0) > MAX_MB * 1024 * 1024) return setError(t('resumeBrain.tooBig', { mb: MAX_MB }));
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function read() {
    if (!file || !consent) return;
    const mine = ++attempt.current;
    setError('');
    setStep('reading');
    try {
      const response = await readResume(file);
      if (mine !== attempt.current) return;
      setResult(response);
      const found = response.parsedResume.personalInfo;
      setInfo({ fullName: found.fullName ?? '', email: found.email ?? '', phone: found.phone ?? '', location: found.location ?? '' });
      setSkills(response.parsedResume.skills.filter(Boolean));
      setStep('review');
    } catch (failure) {
      if (mine !== attempt.current) return;
      setError(errorText(failure, t, 'resumeBrain.readFailed'));
      setStep('upload');
    }
  }

  async function apply() {
    if (!result || !user) return;
    setBusy(true);
    setError('');
    try {
      await autofillProfile(user.id, result.parsedResume.id, { personalInfo: info, skills });
      await refreshUser();
      setStep('done');
    } catch (failure) {
      setError(errorText(failure, t, 'resumeBrain.applyFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeFile() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      await deleteResume(result.upload.id);
      setDeleted(true);
    } catch (failure) {
      setError(errorText(failure, t, 'resumeBrain.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  function useInCvMaker() {
    if (!result) return;
    setImport({ ...result.parsedResume, personalInfo: info, skills });
    router.push('/cv-maker');
  }

  function restart() {
    attempt.current += 1;
    setStep('upload');
    setFile(null);
    setResult(null);
    setDeleted(false);
    setError('');
  }

  return (
    <Screen title={t('resumeBrain.title')}>
      <Muted>{t('resumeBrain.subtitle')}</Muted>
      {error ? <Notice tone="bad" text={error} /> : null}

      {step === 'upload' ? (
        <Card>
          <Pressable onPress={pick} accessibilityRole="button" className="items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 p-6 dark:border-slate-700">
            <FileText color={colors.accent} size={32} />
            <Text className="text-center text-[15px] font-bold text-ink-900 dark:text-white">{file ? file.name : t('resumeBrain.choose')}</Text>
            <Muted className="text-center">{t('resumeBrain.types')}</Muted>
          </Pressable>
          <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} className="flex-row items-start gap-3">
            <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${consent ? 'border-forest bg-forest dark:border-limeAccent dark:bg-limeAccent' : 'border-ink-400'}`}>
              {consent ? <Check color={colors.onAccent} size={14} /> : null}
            </View>
            <Text className="flex-1 text-sm leading-5 text-ink-700 dark:text-slate-300">{t('resumeBrain.consent')}</Text>
          </Pressable>
          <Button label={t('resumeBrain.read')} disabled={!file || !consent} onPress={read} />
        </Card>
      ) : null}

      {step === 'reading' ? (
        <Card className="items-center py-10">
          <ActivityIndicator size="large" color={colors.accent} />
          <H2>{t('resumeBrain.reading')}</H2>
          <Button small variant="outline" label={t('postJob.cancel')} onPress={restart} />
        </Card>
      ) : null}

      {step === 'review' && result ? (
        <>
          <Muted>{t('resumeBrain.reviewIntro')}</Muted>
          <Card>
            <H2>{t('resumeBrain.contact')}</H2>
            {FIELDS.map((field) => (
              <Field
                key={field}
                label={t(`resumeBrain.fields.${field}`)}
                value={info[field] ?? ''}
                onChangeText={(value) => setInfo({ ...info, [field]: value })}
                hint={info[field] ? undefined : t('resumeBrain.notFound')}
                autoCapitalize={field === 'email' ? 'none' : 'words'}
              />
            ))}
          </Card>
          <Card>
            <H2>{t('resumeBrain.skills')}</H2>
            {skills.length === 0 ? <Muted>{t('resumeBrain.noSkills')}</Muted> : null}
            <View className="flex-row flex-wrap gap-2">
              {skills.map((skill) => (
                <Pressable key={skill} onPress={() => setSkills(skills.filter((s) => s !== skill))} accessibilityRole="button" className="flex-row items-center gap-1 rounded-full bg-ink-100 px-3 py-1.5 dark:bg-slate-800">
                  <Text className="text-[13px] font-semibold text-ink-800 dark:text-slate-100">{skill}</Text>
                  <X color={colors.muted} size={14} />
                </Pressable>
              ))}
            </View>
          </Card>
          <Card>
            <H2>{t('resumeBrain.found')}</H2>
            <Badge label={`${t('resumeBrain.experience')}: ${result.parsedResume.workExperience.length}`} />
            <Badge label={`${t('resumeBrain.education')}: ${result.parsedResume.education.length}`} />
            <Muted>{t('resumeBrain.adds')}</Muted>
          </Card>
          <Button label={t('m.resume.apply')} busy={busy} onPress={apply} />
          <Button label={t('resumeBrain.useInCv')} variant="outline" onPress={useInCvMaker} />
          <Button label={t('resumeBrain.startOver')} variant="ghost" onPress={restart} />
        </>
      ) : null}

      {step === 'done' ? (
        <Card>
          <Check color={colors.accent} size={32} />
          <H1>{t('resumeBrain.doneTitle')}</H1>
          <Muted>{t('resumeBrain.doneText')}</Muted>
          <Button label={t('resumeBrain.viewProfile')} onPress={() => router.replace('/profile')} />
          <Button label={t('resumeBrain.findJobs')} variant="outline" onPress={() => router.replace('/(tabs)/jobs')} />
          <Button label={t('resumeBrain.useInCv')} variant="outline" onPress={useInCvMaker} />
          {deleted ? <Notice tone="good" text={t('resumeBrain.deleted')} /> : <Button label={t('resumeBrain.deleteFile')} variant="danger" busy={busy} onPress={removeFile} />}
          <Button label={t('resumeBrain.another')} variant="ghost" onPress={restart} />
        </Card>
      ) : null}
    </Screen>
  );
}
