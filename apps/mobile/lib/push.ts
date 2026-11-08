import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { registerPushToken } from '../api/notifications';
import { useAuth } from '../store/auth.store';
import { refreshUnread } from './unread';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Where a push notification should open, from the `path` the API puts in its data. */
function open(data: unknown) {
  const path = (data as { path?: unknown } | undefined)?.path;
  if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')) router.push(path as Href);
  else router.push('/notifications');
}

/**
 * Once signed in: asks for permission, registers this phone's Expo push token with the API, and
 * opens the right screen when a notification is tapped.
 */
export function usePushNotifications() {
  const userId = useAuth((s) => s.user?.id);
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || registeredFor.current === userId) return;
    registeredFor.current = userId;
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', { name: 'Beleqet', importance: Notifications.AndroidImportance.HIGH });
      }
      const current = await Notifications.getPermissionsAsync();
      const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await registerPushToken(token);
    })().catch(() => {
      // No push on this phone (no Play services, permission refused): the in-app list still works.
      registeredFor.current = null;
    });
  }, [userId]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => void refreshUnread());
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
    // A tap that launched the app from closed.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) open(response.notification.request.content.data);
      })
      .catch(() => undefined);
    return () => {
      received.remove();
      tapped.remove();
    };
  }, []);
}
