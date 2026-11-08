import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthShell, useAfterSignIn } from '../../components/auth-shell';
import { Button, Field, Notice } from '../../components/ui';
import { completeTwoFactor } from '../../api/auth';
import { authError } from '../../lib/auth-errors';
import { useTranslation } from '../../lib/i18n';

/** Second step for accounts with two-step sign-in: the authenticator code or a backup code. */
export default function TwoFactor() {
  const { t } = useTranslation();
  const { tempToken, next } = useLocalSearchParams<{ tempToken: string; next?: string }>();
  const afterSignIn = useAfterSignIn();
  const [kind, setKind] = useState<'app' | 'backup'>('app');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!code.trim()) return;
    setBusy(true);
    try {
      const result = await completeTwoFactor(tempToken, code.trim(), kind);
      if (result.status === 'signed-in') await afterSignIn(result.user, next);
    } catch (failure) {
      setError(authError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  const app = kind === 'app';
  return (
    <AuthShell title={t(app ? 'auth.codeTitle' : 'auth.backupTitle')} sub={t(app ? 'auth.codeSub' : 'auth.backupSub')}>
      <Field
        label={t(app ? 'auth.codeLabel' : 'auth.backupLabel')}
        value={code}
        onChangeText={(value) => setCode(app ? value.replace(/\D/g, '').slice(0, 6) : value.slice(0, 20))}
        keyboardType={app ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoFocus
        onSubmitEditing={submit}
      />
      {error ? <Notice tone="bad" text={error} /> : null}
      <Button label={busy ? t('auth.checking') : t('auth.verify')} onPress={submit} busy={busy} />
      <Pressable
        onPress={() => {
          setKind(app ? 'backup' : 'app');
          setCode('');
          setError('');
        }}
        accessibilityRole="button"
        className="min-h-10 items-center justify-center"
      >
        <Text className="text-sm font-bold text-forest dark:text-limeAccent">{t(app ? 'auth.useBackup' : 'auth.useApp')}</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="button" className="min-h-10 items-center justify-center">
        <Text className="text-sm font-bold text-forest dark:text-limeAccent">{t('auth.backToSignIn')}</Text>
      </Pressable>
    </AuthShell>
  );
}
