import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../store/auth.store';
import { resendVerification } from '../api/auth';
import { useTranslation } from '../lib/i18n';

/** Like the website's banner: unconfirmed accounts can't post, apply, bid or pay. */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const refreshUser = useAuth((s) => s.refreshUser);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [hidden, setHidden] = useState(false);

  // Telegram sign-ups get a placeholder address with no inbox; the API doesn't ask them to confirm.
  if (!user || user.emailVerified !== false || hidden || /@telegram\.|\.local$/i.test(user.email)) return null;

  async function send() {
    setState('sending');
    try {
      await resendVerification();
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <View className="gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950">
      <Text className="text-sm font-semibold leading-5 text-amber-900 dark:text-amber-100">{t('auth.verifyBanner.message', { email: user.email })}</Text>
      <View className="flex-row flex-wrap items-center gap-4">
        {state === 'sent' ? (
          <Text className="text-[13px] font-semibold text-forest dark:text-limeAccent">{t('auth.verifyBanner.sent')}</Text>
        ) : (
          <Pressable onPress={send} disabled={state === 'sending'} accessibilityRole="button" className="min-h-9 justify-center">
            <Text className="text-[13px] font-bold text-amber-900 underline dark:text-amber-100">
              {state === 'sending' ? t('auth.verifyBanner.sending') : t('auth.verifyBanner.send')}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => void refreshUser()} accessibilityRole="button" className="min-h-9 justify-center">
          <Text className="text-[13px] font-bold text-amber-900 underline dark:text-amber-100">{t('m.verify.done')}</Text>
        </Pressable>
        <Pressable onPress={() => setHidden(true)} accessibilityRole="button" className="min-h-9 justify-center">
          <Text className="text-[13px] font-bold text-amber-900 dark:text-amber-100">{t('auth.verifyBanner.dismiss')}</Text>
        </Pressable>
      </View>
      {state === 'failed' ? <Text className="text-[13px] font-semibold text-red-700 dark:text-red-300">{t('auth.verifyBanner.failed')}</Text> : null}
    </View>
  );
}
