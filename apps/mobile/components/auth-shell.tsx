import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../store/auth.store';
import { useTranslation } from '../lib/i18n';

/** The sign-in pages: brand bar on top, the form in a card below. */
export function AuthShell({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-obsidian">
      <SafeAreaView edges={['top']}>
        <View className="flex-row items-center gap-2 px-2 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('m.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
          >
            <ChevronLeft color="#fff" size={24} />
          </Pressable>
          <Image source={require('../assets/icon.png')} className="h-8 w-8 rounded-lg" accessibilityIgnoresInvertColors />
          <Text className="text-xl font-extrabold text-white">
            Beleqet<Text className="text-limeAccent">.</Text>
          </Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
          <View className="px-5 pb-6 pt-3">
            <Text className="text-[28px] font-extrabold leading-9 text-white">{title}</Text>
            {sub ? <Text className="mt-1.5 text-[15px] leading-6 text-white/75">{sub}</Text> : null}
          </View>
          <View className="flex-1 gap-4 rounded-t-3xl bg-canvas px-5 pb-10 pt-6 dark:bg-slate-950">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Where to go after signing in: back to what the person was doing, or their home tab. */
export function useAfterSignIn() {
  const signedIn = useAuth((s) => s.signedIn);
  return async (user: Parameters<typeof signedIn>[0], next?: string) => {
    await signedIn(user);
    const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    router.dismissAll?.();
    router.replace(target as Href);
  };
}
