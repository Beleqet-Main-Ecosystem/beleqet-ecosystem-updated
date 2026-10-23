import '../global.css';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth.store';

// Keep the splash visible until we finish hydrating auth
SplashScreen.preventAutoHideAsync();

/**
 * Guards navigation so that:
 *  - Authenticated users in the auth group get redirected to tabs.
 *  - Unauthenticated users can freely browse jobs/freelance/detail screens.
 *  - Unauthenticated users accessing protected screens (profile, chat,
 *    notifications) are redirected to login.
 */
function AuthGuard() {
  const { status } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'authenticated' && inAuthGroup) {
      // Already logged in — go to main tabs
      router.replace('/(tabs)/jobs');
    }
    // NOTE: We no longer force guests to login. Individual screens
    // (profile, chat, notifications) check auth state themselves
    // and redirect to login when the user tries a protected action.
  }, [status, segments]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const status = useAuthStore((s) => s.status);

  // Hydrate auth on first mount
  useEffect(() => {
    hydrate();
  }, []);

  // Hide splash once we know the auth state
  useEffect(() => {
    if (status !== 'idle' && status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [status]);

  return (
    <>
      <StatusBar style="auto" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="job/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Job Detail',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#041603' },
            headerTintColor: '#d8ff3e',
            headerTitleStyle: { color: '#ffffff' },
          }}
        />
        <Stack.Screen
          name="gig/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Gig Detail',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: '#041603' },
            headerTintColor: '#d8ff3e',
            headerTitleStyle: { color: '#ffffff' },
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
      <Toast />
    </>
  );
}
