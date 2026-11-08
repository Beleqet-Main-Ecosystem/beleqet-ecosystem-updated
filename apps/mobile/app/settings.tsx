import { useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen, Card, H2, Muted, Field, Button, Notice, Toggle, Chips, Loading, Failed, Divider } from '../components/ui';
import { fetchPrefs, savePrefs } from '../api/notifications';
import { fetchProfile, updateProfile } from '../api/seeker';
import { send, get } from '../lib/api';
import { isEmployer, useAuth } from '../store/auth.store';
import { useTranslation, type Locale } from '../lib/i18n';
import { useTheme, type ThemePreference } from '../lib/theme';
import { useLoad } from '../lib/use-load';
import { errorText, toApiError } from '../lib/api-error';

const CHANNELS = ['emailEnabled', 'telegramEnabled', 'inAppEnabled'] as const;

/** Settings, as on the website: how we reach you, display, feed, two-step sign-in, delete account. */
export default function Settings() {
  const { t, locale, setLocale } = useTranslation();
  const { preference, setPreference } = useTheme();
  const user = useAuth((s) => s.user);
  const prefs = useLoad(fetchPrefs, []);
  const profile = useLoad(fetchProfile, [], { enabled: !isEmployer(user) });
  const [feedOverride, setFeedOverride] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  async function toggleChannel(channel: (typeof CHANNELS)[number]) {
    if (!prefs.data) return;
    const before = prefs.data;
    const next = { ...before, [channel]: !before[channel] };
    prefs.setData(next);
    setError('');
    try {
      await savePrefs({ [channel]: Boolean(next[channel]) });
    } catch {
      prefs.setData(before);
      setError(t('dash.saveFailed'));
    }
  }

  const feedOn = feedOverride ?? Boolean(profile.data?.gdprConsent);
  async function toggleFeed() {
    const next = !feedOn;
    setFeedOverride(next);
    setError('');
    try {
      await updateProfile({ gdprConsent: next });
    } catch {
      setFeedOverride(!next);
      setError(t('dash.saveFailed'));
    }
  }

  return (
    <Screen title={t('dash.tabs.settings')}>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Card>
        <H2>{t('dash.reachYou')}</H2>
        {prefs.loading ? <Loading /> : prefs.error || !prefs.data ? <Failed message={errorText(prefs.error, t)} onRetry={prefs.reload} /> : CHANNELS.map((channel) => (
          <Toggle key={channel} label={t(`dash.channels.${channel}.name`)} hint={t(`dash.channels.${channel}.detail`)} value={Boolean(prefs.data![channel])} onChange={() => toggleChannel(channel)} />
        ))}
      </Card>

      <Card>
        <H2>{t('dash.display')}</H2>
        <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('dash.language')}</Text>
        <Chips value={locale} onChange={(value) => setLocale(value as Locale)} options={[{ value: 'en', label: 'English' }, { value: 'am', label: 'አማርኛ' }]} />
        <Text className="text-sm font-semibold text-ink-900 dark:text-white">{t('dash.theme')}</Text>
        <Chips
          value={preference}
          onChange={(value) => setPreference(value as ThemePreference)}
          options={[
            { value: 'system', label: t('dash.themeSystem') },
            { value: 'light', label: t('dash.themeLight') },
            { value: 'dark', label: t('dash.themeDark') },
          ]}
        />
      </Card>

      {!isEmployer(user) ? (
        <Card>
          <Toggle label={t('dash.feedToggle')} hint={t('dash.feedToggleText')} value={feedOn} onChange={toggleFeed} disabled={profile.loading} />
          <Divider />
          <Button small variant="ghost" label={t('dash.alerts.title')} onPress={() => router.push('/alerts')} />
        </Card>
      ) : null}

      <TwoStep />
      <DeleteAccount />
    </Screen>
  );
}

type Status = { enabled: boolean; backupCodesLeft: number };
type Enrollment = { qrCode: string; secret: string; enrollmentToken: string };

/** Turn two-step sign-in on (authenticator app), off, or get new backup codes. Same calls as the website. */
function TwoStep() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const status = useLoad(() => get<Status>('/auth/2fa/status'), []);
  const [step, setStep] = useState<'idle' | 'setup' | 'disable' | 'regenerate'>('idle');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function reset(next: typeof step) {
    setStep(next);
    setCode('');
    setError('');
  }

  async function start() {
    setBusy(true);
    setError('');
    try {
      setEnrollment(await send<Enrollment>('POST', '/auth/2fa/enroll'));
      reset('setup');
    } catch (failure) {
      setError(errorText(failure, t, 'twoStep.startFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) return setError(t('twoStep.codeFormat'));
    setBusy(true);
    setError('');
    try {
      if (step === 'setup') {
        const result = await send<{ backupCodes: string[] }>('POST', '/auth/2fa/confirm', { enrollmentToken: enrollment!.enrollmentToken, code: code.trim() });
        setCodes(result.backupCodes);
      } else if (step === 'disable') {
        await send('POST', '/auth/2fa/disable', { code: code.trim() });
      } else if (step === 'regenerate') {
        const { stepUpToken } = await send<{ stepUpToken: string }>('POST', '/auth/2fa/challenge', { action: 'regenerate_backup_codes' });
        const result = await send<{ backupCodes: string[] }>('POST', '/auth/2fa/backup-codes/regenerate', { stepUpToken, code: code.trim() });
        setCodes(result.backupCodes);
      }
      reset('idle');
      await status.reload();
    } catch (failure) {
      const problem = toApiError(failure);
      setError(problem.status === 400 || problem.status === 401 ? t('twoStep.wrongCode') : errorText(failure, t));
    } finally {
      setBusy(false);
    }
  }

  // On a phone the QR code can't be scanned by the same phone: open the authenticator directly.
  const otpauth = enrollment ? `otpauth://totp/Beleqet:${encodeURIComponent(user?.email ?? '')}?secret=${enrollment.secret}&issuer=Beleqet` : '';

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <H2>{t('twoStep.title')}</H2>
        {status.data ? <Text className={`text-sm font-bold ${status.data.enabled ? 'text-forest dark:text-limeAccent' : 'text-ink-500'}`}>{t(status.data.enabled ? 'twoStep.on' : 'twoStep.off')}</Text> : null}
      </View>
      {status.loading ? <Loading /> : status.error ? <Failed message={t('twoStep.loadFailed')} onRetry={status.reload} /> : null}
      {codes ? (
        <View className="gap-2 rounded-lg bg-canvas p-3 dark:bg-slate-800">
          <Text className="font-bold text-ink-900 dark:text-white">{t('twoStep.codesTitle')}</Text>
          <Muted>{t('twoStep.codesText')}</Muted>
          <Text selectable className="font-mono text-base leading-7 text-ink-900 dark:text-white">{codes.join('\n')}</Text>
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('m.copy')} onPress={() => Clipboard.setStringAsync(codes.join('\n'))} />
            <Button className="flex-1" small variant="outline" label={t('m.share')} onPress={() => Share.share({ message: `${t('twoStep.fileHeading')}\n\n${codes.join('\n')}` })} />
          </View>
          <Button small label={t('twoStep.saved')} onPress={() => setCodes(null)} />
        </View>
      ) : null}
      {status.data && step === 'idle' && !codes ? (
        status.data.enabled ? (
          <>
            <Muted>{t('twoStep.codesLeft', { count: status.data.backupCodesLeft })}</Muted>
            <View className="flex-row gap-2">
              <Button className="flex-1" small variant="outline" label={t('twoStep.newCodes')} onPress={() => reset('regenerate')} />
              <Button className="flex-1" small variant="danger" label={t('twoStep.turnOff')} onPress={() => reset('disable')} />
            </View>
          </>
        ) : (
          <>
            <Muted>{t('twoStep.offText')}</Muted>
            <Button small label={t('twoStep.turnOn')} busy={busy} onPress={start} />
          </>
        )
      ) : null}
      {step === 'setup' && enrollment ? (
        <View className="gap-3">
          <Muted>{`1. ${t('twoStep.step1')}`}</Muted>
          <Muted>{`2. ${t('twoStep.step2')}`}</Muted>
          <Button small variant="outline" label={t('m.twoStep.openApp')} onPress={() => Linking.openURL(otpauth).catch(() => setError(t('m.twoStep.noApp')))} />
          {enrollment.qrCode.startsWith('data:image') ? <Image source={{ uri: enrollment.qrCode }} accessibilityLabel={t('twoStep.qrAlt')} className="h-44 w-44 self-center rounded-lg bg-white" /> : null}
          <Muted>{t('twoStep.manual')}</Muted>
          <Pressable onPress={() => Clipboard.setStringAsync(enrollment.secret)} accessibilityRole="button" accessibilityHint={t('m.copy')}>
            <Text selectable className="font-mono text-base font-bold tracking-widest text-ink-900 dark:text-white">{enrollment.secret}</Text>
          </Pressable>
          <Muted>{`3. ${t('twoStep.step3')}`}</Muted>
        </View>
      ) : null}
      {step === 'disable' ? <Muted>{t('twoStep.disableText')}</Muted> : null}
      {step === 'regenerate' ? <Muted>{t('twoStep.regenerateText')}</Muted> : null}
      {step !== 'idle' ? (
        <>
          <Field label={t('twoStep.codeLabel')} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('postJob.cancel')} onPress={() => reset('idle')} />
            <Button className="flex-1" small variant={step === 'disable' ? 'danger' : 'solid'} label={step === 'setup' ? t('twoStep.confirm') : step === 'disable' ? t('twoStep.turnOff') : t('twoStep.newCodes')} busy={busy} onPress={submit} />
          </View>
        </>
      ) : null}
      {error ? <Notice tone="bad" text={error} /> : null}
    </Card>
  );
}

/** Delete my account. The password confirms it (Google-only accounts leave it blank); typing DELETE stops a stray tap. */
function DeleteAccount() {
  const { t } = useTranslation();
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (confirm !== 'DELETE') return setError(t('dash.deleteTypeIt'));
    setBusy(true);
    setError('');
    try {
      await send('POST', '/v1/compliance/gdpr/erase-me', { password: password || undefined, confirm });
      await signOut();
      router.replace('/(tabs)/home');
    } catch (failure) {
      const status = toApiError(failure).status;
      setError(status === 401 ? t('dash.deleteWrongPassword') : status === 409 ? t('dash.deleteOpenContracts') : errorText(failure, t, 'dash.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <H2>{t('dash.privacy')}</H2>
      <Text className="text-[15px] font-bold text-ink-900 dark:text-white">{t('dash.deleteTitle')}</Text>
      <Muted>{t('dash.deleteExplain')}</Muted>
      {!open ? <Button small variant="danger" label={t('dash.deleteStart')} onPress={() => setOpen(true)} /> : (
        <>
          <Field label={t('dash.deletePassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          <Muted>{t('dash.deleteSocialNote')}</Muted>
          <Field label={t('dash.deleteConfirm')} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
          {error ? <Notice tone="bad" text={error} /> : null}
          <View className="flex-row gap-2">
            <Button className="flex-1" small variant="outline" label={t('postJob.cancel')} onPress={() => { setOpen(false); setError(''); }} />
            <Button className="flex-1" small variant="danger" label={t('dash.deleteStart')} busy={busy} onPress={remove} />
          </View>
        </>
      )}
    </Card>
  );
}
