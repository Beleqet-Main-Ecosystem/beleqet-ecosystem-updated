import { useState } from 'react';
import { router } from 'expo-router';
import { AuthShell } from '../../components/auth-shell';
import { Body, Button, Field, Muted, Notice } from '../../components/ui';
import { requestPasswordReset } from '../../api/auth';
import { authError } from '../../lib/auth-errors';
import { useTranslation } from '../../lib/i18n';

/**
 * Sends the reset link. The link opens the website's reset page, which sets the new password;
 * then the person signs in here.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim()) return;
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (failure) {
      setError(authError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={t('auth.resetSentTitle')}>
        <Body>
          {t('auth.resetSentSub1')} {email.trim()}
          {t('auth.resetSentSub2')}
        </Body>
        <Muted>{t('m.auth.resetInBrowser')}</Muted>
        <Button label={t('auth.backToSignIn')} onPress={() => router.replace('/(auth)/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('auth.resetTitle')} sub={t('auth.resetSub')}>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onSubmitEditing={submit} />
      {error ? <Notice tone="bad" text={error} /> : null}
      <Button label={busy ? t('auth.sending') : t('auth.sendLink')} onPress={submit} busy={busy} />
      <Button label={t('auth.backToSignIn')} variant="ghost" onPress={() => router.back()} />
    </AuthShell>
  );
}
