import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText } from 'lucide-react-native';
import { Screen, Card, H1, H2, Muted, Field, Button, Notice, Loading, Failed } from '../../../components/ui';
import { applyToJob, fetchJob } from '../../../api/jobs';
import { fetchApplications, fetchProfile } from '../../../api/seeker';
import { uploadFile, type PickedFile } from '../../../lib/api';
import { errorText, toApiError } from '../../../lib/api-error';
import { useTranslation } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { useLoad } from '../../../lib/use-load';
import { daysUntil, safeHttpUrl } from '../../../lib/format';

const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const COVER_MIN = 50;

/** Same rules as the website's ApplyForm: the profile CV or a new upload, optional extras. */
export default function Apply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const load = useLoad(() => Promise.all([fetchJob(id), fetchProfile(), fetchApplications()]), [id]);
  const [choice, setChoice] = useState<'profile' | 'upload' | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [consent, setConsent] = useState(false);
  const [cover, setCover] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [salary, setSalary] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'sent'>('form');
  const [error, setError] = useState('');

  if (load.loading) return <Screen title={t('job.apply.title')}><Loading /></Screen>;
  if (load.error || !load.data) return <Screen title={t('job.apply.title')}><Failed message={errorText(load.error, t)} onRetry={load.reload} /></Screen>;

  const [job, profile, apps] = load.data;
  const profileCv = profile.defaultResumeUrl;
  const cvChoice = choice ?? (profileCv ? 'profile' : 'upload');
  const already = apps.some((app) => app.jobId === id);
  const days = daysUntil(job.closesAt);
  const closed = days !== null && days < 0;

  if (state === 'sent') {
    return (
      <Screen title={t('job.apply.title')}>
        <Card>
          <Check color={colors.accent} size={32} />
          <H1>{t('m.apply.sent')}</H1>
          <Muted>{t('job.apply.sentText', { company: job.company })}</Muted>
          <Button label={t('job.apply.track')} onPress={() => router.replace('/applications')} />
          <Button label={t('job.apply.keepBrowsing')} variant="outline" onPress={() => router.replace('/(tabs)/jobs')} />
        </Card>
      </Screen>
    );
  }

  if (already || closed) {
    return (
      <Screen title={t('job.apply.title')}>
        <Notice tone={already ? 'info' : 'warn'} text={already ? t('job.apply.duplicateText') : t('job.apply.errClosed')} />
        <Button label={already ? t('job.apply.track') : t('job.apply.backToJob')} onPress={() => (already ? router.replace('/applications') : router.back())} />
      </Screen>
    );
  }

  const coverShort = cover.trim().length > 0 && cover.trim().length < COVER_MIN;
  const portfolioUrl = portfolio.trim() ? safeHttpUrl(portfolio) : null;
  const portfolioBad = portfolio.trim().length > 0 && !portfolioUrl;
  const needsFile = cvChoice === 'upload';
  const canSend = state === 'form' && !coverShort && !portfolioBad && (!needsFile || (file && consent));

  async function pick() {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: CV_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.mimeType && !CV_TYPES.includes(asset.mimeType)) return setError(t('job.apply.errType'));
    if ((asset.size ?? 0) > MAX_CV_BYTES) return setError(t('job.apply.errSize'));
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
  }

  async function send() {
    if (!canSend) return;
    setError('');
    setState('sending');
    try {
      const resumeUrl = cvChoice === 'profile' ? profileCv ?? undefined : await uploadFile(file!);
      await applyToJob({
        jobId: id,
        resumeUrl,
        coverLetter: cover.trim() || undefined,
        portfolioUrl: portfolioUrl ?? undefined,
        expectedSalary: salary ? Number(salary) : undefined,
      });
      setState('sent');
    } catch (failure) {
      const status = toApiError(failure).status;
      setError(status === 404 ? t('job.apply.errClosed') : errorText(failure, t, 'job.apply.errGeneric'));
      setState('form');
    }
  }

  return (
    <Screen
      title={t('job.apply.title')}
      footer={<Button label={state === 'sending' ? t('job.apply.sending') : t('job.apply.send')} onPress={send} busy={state === 'sending'} disabled={!canSend} />}
    >
      <View className="gap-1">
        <H1>{job.title}</H1>
        <Muted>{[job.company, job.location].filter(Boolean).join(' · ')}</Muted>
      </View>
      <Card>
        <H2>{t('job.apply.cv')}</H2>
        {profileCv ? (
          <Choice selected={cvChoice === 'profile'} onPress={() => setChoice('profile')} title={t('job.apply.useProfileCv')} hint={t('job.apply.useProfileCvHint')} />
        ) : null}
        <Choice selected={cvChoice === 'upload'} onPress={() => setChoice('upload')} title={t('job.apply.chooseFile')} hint={t('job.apply.uploadHint')} />
        {cvChoice === 'upload' ? (
          <>
            <Button label={file ? file.name : t('job.apply.chooseFile')} variant="outline" icon={<FileText color={colors.text} size={18} />} onPress={pick} />
            <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }} className="flex-row items-start gap-3">
              <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${consent ? 'border-forest bg-forest dark:border-limeAccent dark:bg-limeAccent' : 'border-ink-400'}`}>
                {consent ? <Check color={colors.onAccent} size={14} /> : null}
              </View>
              <Text className="flex-1 text-sm leading-5 text-ink-700 dark:text-slate-300">{t('job.apply.consent')}</Text>
            </Pressable>
          </>
        ) : null}
      </Card>
      <Field
        label={`${t('job.apply.cover')} (${t('job.apply.optional')})`}
        value={cover}
        onChangeText={setCover}
        multiline
        placeholder={t('job.apply.coverPlaceholder')}
        hint={t('job.apply.coverHint')}
        error={coverShort ? t('job.apply.coverShort', { n: COVER_MIN - cover.trim().length }) : undefined}
      />
      <Field label={`${t('job.apply.portfolio')} (${t('job.apply.optional')})`} value={portfolio} onChangeText={setPortfolio} autoCapitalize="none" keyboardType="url" error={portfolioBad ? t('job.apply.portfolioInvalid') : undefined} />
      <Field label={`${t('job.apply.expectedSalary')} (${t('job.apply.optional')})`} value={salary} onChangeText={(value) => setSalary(value.replace(/\D/g, ''))} keyboardType="number-pad" />
      {error ? <Notice tone="bad" text={error} /> : null}
    </Screen>
  );
}

function Choice({ selected, onPress, title, hint }: { selected: boolean; onPress: () => void; title: string; hint: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} className={`flex-row items-center gap-3 rounded-lg border-2 p-3 ${selected ? 'border-forest dark:border-limeAccent' : 'border-ink-200 dark:border-slate-800'}`}>
      <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-forest dark:border-limeAccent' : 'border-ink-400'}`}>
        {selected ? <View className="h-2.5 w-2.5 rounded-full bg-forest dark:bg-limeAccent" /> : null}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-ink-900 dark:text-white">{title}</Text>
        <Muted>{hint}</Muted>
      </View>
    </Pressable>
  );
}
