import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { AuthShell, useAfterSignIn } from '../../components/auth-shell';
import { Button, Field, Notice } from '../../components/ui';
import { signIn } from '../../api/auth';
import { authError } from '../../lib/auth-errors';
import { useTranslation } from '../../lib/i18n';
import { signInWithProvider } from '../../lib/oauth';

export default function Login() {
  const { t } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const afterSignIn = useAfterSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'' | 'password' | 'google'>('');
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || !password) {
      setError(t('auth.required'));
      return;
    }
    setBusy('password');
    try {
      const result = await signIn(email, password);
      if (result.status === 'signed-in') await afterSignIn(result.user, next);
      else if (result.status === 'needs-code') router.push({ pathname: '/(auth)/two-factor', params: { tempToken: result.tempToken, next } });
      else router.push({ pathname: '/(auth)/verify-email', params: { token: result.verificationToken, email: result.email, next } });
    } catch (failure) {
      setError(authError(failure, t));
    } finally {
      setBusy('');
    }
  }

  async function google() {
    setError('');
    setBusy('google');
    try {
      const result = await signInWithProvider('google');
      if (!result) return;
      if (result.status === 'signed-in') await afterSignIn(result.user, next);
      else if (result.status === 'needs-code') router.push({ pathname: '/(auth)/two-factor', params: { tempToken: result.tempToken, next } });
      else if (result.status === 'confirm') setError(t('auth.oauthConfirm'));
    } catch {
      setError(t('auth.oauthFailed'));
    } finally {
      setBusy('');
    }
  }

  return (
    <AuthShell title={t('auth.welcomeBack')} sub={t('auth.signInSub')}>
      <Button label={t('m.auth.google')} variant="outline" onPress={google} busy={busy === 'google'} disabled={Boolean(busy)} />
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-ink-200 dark:bg-slate-800" />
        <Text className="text-[13px] text-ink-500 dark:text-slate-400">{t('auth.orEmail')}</Text>
        <View className="h-px flex-1 bg-ink-200 dark:bg-slate-800" />
      </View>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" />
      <View className="gap-1.5">
        <Field
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <View className="flex-row justify-between">
          <Pressable onPress={() => setShow(!show)} accessibilityRole="button" className="min-h-9 justify-center">
            <Text className="text-[13px] font-bold text-forest dark:text-limeAccent">{show ? t('auth.hidePassword') : t('auth.showPassword')}</Text>
          </Pressable>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable accessibilityRole="link" className="min-h-9 justify-center">
              <Text className="text-[13px] font-bold text-forest dark:text-limeAccent">{t('auth.forgot')}</Text>
            </Pressable>
          </Link>
        </View>
      </View>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Button label={busy === 'password' ? t('auth.signingIn') : t('auth.signIn')} onPress={submit} busy={busy === 'password'} disabled={Boolean(busy)} />
      <View className="flex-row flex-wrap items-center justify-center gap-1">
        <Text className="text-sm text-ink-600 dark:text-slate-300">{t('auth.newHere')}</Text>
        <Pressable onPress={() => router.replace({ pathname: '/(auth)/register', params: { next } })} accessibilityRole="link" className="min-h-9 justify-center">
          <Text className="text-sm font-bold text-forest dark:text-limeAccent">{t('auth.createAccount')}</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
