import { useEffect, useState } from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';
import { Screen, Card, H2, Muted, Body, Button, Select, Notice, Empty } from '../components/ui';
import { conversationId, deleteTranscript, fetchTranscripts, forgetConversation, LANGUAGES, transcribe, type Transcript } from '../api/voice';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { errorText, toApiError } from '../lib/api-error';
import { shortDate } from '../lib/format';

const MAX_SECONDS = 300;

/** Speak (or pick a recording) and get the text, in Amharic or another language. */
export default function ChatToText() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [language, setLanguage] = useState(locale === 'am' ? 'am' : 'en');
  const [conversation, setConversation] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const id = await conversationId();
        setConversation(id);
        setTranscripts(await fetchTranscripts(id));
      } catch (failure) {
        // A conversation deleted on the server: start a fresh one next time.
        if (toApiError(failure).status === 404) await forgetConversation();
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, recording]);

  if (!user) {
    return (
      <Screen title={t('voice.title')}>
        <Empty title={t('voice.signInTitle')} action={<Button small label={t('auth.signIn')} onPress={() => router.push({ pathname: '/(auth)/login', params: { next: '/chat-to-text' } })} />} />
      </Screen>
    );
  }

  async function send(file: { uri: string; name: string; mimeType: string }) {
    setWorking(true);
    setError('');
    try {
      const id = conversation ?? (await conversationId());
      setConversation(id);
      const result = await transcribe(id, language, file);
      setTranscripts((list) => [result, ...list.filter((item) => item.id !== result.id)]);
    } catch (failure) {
      setError(errorText(failure, t, 'voice.failed'));
    } finally {
      setWorking(false);
    }
  }

  async function start() {
    setError('');
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) return setError(t('voice.micAsk'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setSeconds(0);
    setRecording(true);
  }

  async function stop() {
    setRecording(false);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    if (recorder.uri) await send({ uri: recorder.uri, name: 'recording.m4a', mimeType: 'audio/m4a' });
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await send({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'audio/mpeg' });
  }

  async function remove(item: Transcript) {
    setTranscripts((list) => list.filter((entry) => entry.id !== item.id));
    await deleteTranscript(item.id).catch(() => undefined);
  }

  const textOf = (item: Transcript) => item.normalizedText ?? item.rawText ?? '';
  const latest = transcripts[0];
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Screen title={t('voice.title')}>
      <Muted>{t('voice.sub')}</Muted>
      <Card>
        <Select label={t('voice.language')} value={language} onChange={setLanguage} options={Object.entries(LANGUAGES).map(([value, label]) => ({ value, label }))} />
        <View className="items-center gap-3 py-4">
          <Button
            label={recording ? t('voice.stop') : t('voice.start')}
            variant={recording ? 'danger' : 'solid'}
            icon={recording ? <Square color={colors.danger} size={18} /> : <Mic color={colors.onAccent} size={18} />}
            disabled={working}
            onPress={() => void (recording ? stop() : start())}
            className="min-w-48"
          />
          <Muted>{recording ? `${t('voice.recording')} ${clock}` : t('voice.speaking', { language: LANGUAGES[language] ?? language })}</Muted>
          <Muted>{t('voice.upTo')}</Muted>
        </View>
        <Muted className="text-center">{t('voice.or')}</Muted>
        <Button variant="outline" label={t('m.uploadAudio')} disabled={recording || working} onPress={pickFile} />
        <Muted>{t('voice.privacy')}</Muted>
      </Card>
      {working ? (
        <Card className="items-center">
          <ActivityIndicator color={colors.accent} />
          <H2>{t('voice.working')}</H2>
          <Muted>{t('voice.workingHint')}</Muted>
        </Card>
      ) : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      {latest && !working ? (
        <Card>
          <H2>{t('voice.yourText', { language: LANGUAGES[latest.language] ?? latest.language })}</H2>
          {latest.status === 'FAILED' ? <Notice tone="bad" text={t('voice.failed')} /> : <Body>{textOf(latest) || t('voice.check')}</Body>}
          {textOf(latest) ? (
            <View className="flex-row gap-2">
              <Button className="flex-1" small variant="outline" label={t('voice.copy')} onPress={() => Clipboard.setStringAsync(textOf(latest))} />
              <Button className="flex-1" small variant="outline" label={t('m.share')} onPress={() => Share.share({ message: textOf(latest) })} />
            </View>
          ) : null}
        </Card>
      ) : null}
      <H2>{t('voice.recent')}</H2>
      {transcripts.length === 0 ? <Muted>{t('voice.none')}</Muted> : null}
      {transcripts.slice(1).map((item) => (
        <Card key={item.id}>
          <Muted>{`${shortDate(item.createdAt, locale)} · ${LANGUAGES[item.language] ?? item.language}`}</Muted>
          <Text className="text-sm text-ink-800 dark:text-slate-200" numberOfLines={4}>{textOf(item) || t('voice.failed')}</Text>
          <View className="flex-row gap-2">
            {textOf(item) ? <Button small variant="ghost" label={t('voice.copy')} onPress={() => Clipboard.setStringAsync(textOf(item))} /> : null}
            <Button small variant="ghost" label={t('voice.delete')} onPress={() => remove(item)} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
