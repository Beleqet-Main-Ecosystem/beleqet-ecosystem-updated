import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Briefcase, Building2, Check, Laptop } from 'lucide-react-native';
import { AuthShell, useAfterSignIn } from '../../components/auth-shell';
import { Button, Field, Notice } from '../../components/ui';
import { register, type SignupRole } from '../../api/auth';
import { authError } from '../../lib/auth-errors';
import { useTranslation } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { SITE_URL } from '../../lib/config';

const MIN_PASSWORD = 8;
const ROLES = [
  { role: 'JOB_SEEKER', Icon: Briefcase },
  { role: 'FREELANCER', Icon: Laptop },
  { role: 'EMPLOYER', Icon: Building2 },
] as const;

export default function Register() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ next?: string; role?: string }>();
  const afterSignIn = useAfterSignIn();
  const preset = ROLES.find((item) => item.role === params.role)?.role;
  const [role, setRole] = useState<SignupRole | null>(preset ?? null);
  const [step, setStep] = useState<1 | 2>(preset ? 2 : 1);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  if (step === 1) {
    return (
      <AuthShell title={t('auth.roleTitle')} sub={t('auth.roleSub')}>
        <Text className="text-[13px] font-bold uppercase text-ink-500 dark:text-slate-400">{t('auth.step1')}</Text>
        {ROLES.map(({ role: option, Icon }) => {
          const active = role === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setRole(option)}
              className={`flex-row gap-3 rounded-xl border-2 bg-surface p-4 dark:bg-slate-900 ${active ? 'border-forest dark:border-limeAccent' : 'border-ink-200 dark:border-slate-800'}`}
            >
              <Icon color={colors.accent} size={24} />
              <View className="flex-1 gap-1">
                <Text className="text-base font-bold text-ink-900 dark:text-white">{t(`auth.roles.${option}.title`)}</Text>
                <Text className="text-[13px] leading-5 text-ink-500 dark:text-slate-400">{t(`auth.roles.${option}.text`)}</Text>
              </View>
              {active ? <Check color={colors.accent} size={20} /> : null}
            </Pressable>
          );
        })}
        <Button label={t('auth.continue')} disabled={!role} onPress={() => setStep(2)} />
        <SignInLink next={params.next} />
      </AuthShell>
    );
  }

  const missing = !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || form.password.length < MIN_PASSWORD || !agreed;

  async function submit() {
    setTouched(true);
    setError('');
    if (missing || !role) return;
    setBusy(true);
    try {
      const result = await register({ ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), role });
      if (result.status === 'signed-in') await afterSignIn(result.user, params.next);
      else if (result.status === 'needs-email-code') router.push({ pathname: '/(auth)/verify-email', params: { token: result.verificationToken, email: result.email, next: params.next } });
      else router.push({ pathname: '/(auth)/two-factor', params: { tempToken: result.tempToken, next: params.next } });
    } catch (failure) {
      setError(authError(failure, t));
    } finally {
      setBusy(false);
    }
  }

  const need = (value: string) => (touched && !value.trim() ? t('auth.required') : undefined);
  return (
    <AuthShell title={t('auth.createTitle')} sub={`${t('auth.signingUpAs')} ${t(`auth.roles.${role}.short`)}`}>
      <Pressable onPress={() => setStep(1)} accessibilityRole="button" className="min-h-9 justify-center self-start">
        <Text className="text-[13px] font-bold text-forest dark:text-limeAccent">← {t('m.auth.changeRole')}</Text>
      </Pressable>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label={t('auth.firstName')} value={form.firstName} onChangeText={set('firstName')} autoComplete="given-name" error={need(form.firstName)} />
        </View>
        <View className="flex-1">
          <Field label={t('auth.lastName')} value={form.lastName} onChangeText={set('lastName')} autoComplete="family-name" error={need(form.lastName)} />
        </View>
      </View>
      <Field label={t('auth.email')} value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={need(form.email)} />
      <Field
        label={t('auth.password')}
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={touched && form.password.length < MIN_PASSWORD ? t('auth.passwordShort', { n: MIN_PASSWORD }) : undefined}
      />
      <Pressable onPress={() => setAgreed(!agreed)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} className="flex-row items-start gap-3">
        <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${agreed ? 'border-forest bg-forest dark:border-limeAccent dark:bg-limeAccent' : 'border-ink-400'}`}>
          {agreed ? <Check color={colors.onAccent} size={14} /> : null}
        </View>
        <Text className="flex-1 text-sm leading-5 text-ink-700 dark:text-slate-300">
          {t('auth.agree')}{' '}
          <Text onPress={() => Linking.openURL(`${SITE_URL}/privacy`)} className="font-semibold text-forest underline dark:text-limeAccent">
            {t('footer.privacy')}
          </Text>
          .
        </Text>
      </Pressable>
      {touched && !agreed ? <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">{t('auth.agreeRequired')}</Text> : null}
      {error ? <Notice tone="bad" text={error} /> : null}
      <Button label={busy ? t('auth.creating') : t('auth.createAccount')} onPress={submit} busy={busy} />
      <SignInLink next={params.next} />
    </AuthShell>
  );
}

function SignInLink({ next }: { next?: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap items-center justify-center gap-1">
      <Text className="text-sm text-ink-600 dark:text-slate-300">{t('auth.haveAccount')}</Text>
      <Pressable onPress={() => router.replace({ pathname: '/(auth)/login', params: { next } })} accessibilityRole="link" className="min-h-9 justify-center">
        <Text className="text-sm font-bold text-forest dark:text-limeAccent">{t('auth.signIn')}</Text>
      </Pressable>
    </View>
  );
}
