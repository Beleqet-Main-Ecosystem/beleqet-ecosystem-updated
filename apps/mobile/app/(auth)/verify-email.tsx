import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthShell, useAfterSignIn } from '../../components/auth-shell';
import { Button, Field, Muted, Notice } from '../../components/ui';
import { resendEmailCode, verifyEmailCode } from '../../api/auth';
import { authError } from '../../lib/auth-errors';
import { useTranslation } from '../../lib/i18n';

const RESEND_SECONDS = 60;

/** New accounts confirm their email with the 6-digit code the API emailed. */
export default function VerifyEmail() {
  const { t } = useTranslation();
  const { token, email, next } = useLocalSearchParams<{ token: string; email: string; next?: string }>();
  const afterSignIn = useAfterSignIn();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit() {
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t('auth.emailCodeFormat'));
      return;
    }
    setBusy(true);
    try {
      const result = await verifyEmailCode(token, code.trim());
      if (result.status === 'signed-in') await afterSignIn(result.user, next);
      else if (result.status === 'needs-code') router.replace({ pathname: '/(auth)/two-factor', params: { tempToken: result.tempToken, next } });
    } catch (failure) {
      setError(authError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setNote('');
    try {
      const result = await resendEmailCode(token);
      setNote(result.alreadyVerified ? t('auth.verifiedSub') : t('auth.emailCodeSent'));
      setWait(RESEND_SECONDS);
    } catch (failure) {
      setError(authError(failure, t));
    }
  }

  return (
    <AuthShell title={t('auth.checkEmail')} sub={`${t('auth.emailCodeSub1')} ${email}. ${t('auth.emailCodeSub2')}`}>
      <Field
        label={t('auth.emailCodeLabel')}
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        onSubmitEditing={submit}
        className="text-center text-2xl tracking-[8px]"
      />
      {error ? <Notice tone="bad" text={error} /> : null}
      {note ? <Notice tone="good" text={note} /> : null}
      <Button label={busy ? t('auth.checking') : t('auth.emailCodeVerify')} onPress={submit} busy={busy} />
      <Pressable onPress={resend} disabled={wait > 0} accessibilityRole="button" className="min-h-10 items-center justify-center">
        <Text className={`text-sm font-bold ${wait > 0 ? 'text-ink-400' : 'text-forest dark:text-limeAccent'}`}>
          {wait > 0 ? t('auth.emailCodeResendIn', { s: wait }) : t('auth.emailCodeResend')}
        </Text>
      </Pressable>
      <Muted className="text-center">{t('auth.emailCodeSpam')}</Muted>
      <Pressable onPress={() => router.back()} accessibilityRole="button" className="min-h-10 items-center justify-center">
        <Text className="text-sm font-bold text-forest dark:text-limeAccent">{t('auth.emailCodeBack')}</Text>
      </Pressable>
    </AuthShell>
  );
}
