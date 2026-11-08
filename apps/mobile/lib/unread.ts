import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { create } from 'zustand';
import { fetchNotifications } from '../api/notifications';
import { useAuth } from '../store/auth.store';

type Unread = { count: number; set: (count: number) => void };
export const useUnreadStore = create<Unread>((set) => ({ count: 0, set: (count) => set({ count }) }));

/** Re-reads the unread notification count. */
export async function refreshUnread() {
  try {
    const items = await fetchNotifications();
    useUnreadStore.getState().set(items.filter((item) => !item.read).length);
  } catch {
    // The bell just keeps its last count.
  }
}

/** Unread notifications for the bell; refreshed when the screen or the app comes back. */
export function useUnread(): number {
  const signedIn = useAuth((s) => s.status === 'signed-in');
  const count = useUnreadStore((s) => s.count);

  useFocusEffect(
    useCallback(() => {
      if (signedIn) void refreshUnread();
    }, [signedIn]),
  );

  useEffect(() => {
    if (!signedIn) {
      useUnreadStore.getState().set(0);
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnread();
    });
    return () => subscription.remove();
  }, [signedIn]);

  return count;
}
