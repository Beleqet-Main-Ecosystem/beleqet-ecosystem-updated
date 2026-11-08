import { get, send } from '../lib/api';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export const fetchNotifications = () => get<AppNotification[]>('/users/notifications');
export const markRead = (id: string) => send('PATCH', `/users/notifications/${encodeURIComponent(id)}/read`);
export const markAllRead = () => send('PATCH', '/users/notifications/read-all');

export type NotificationPrefs = Record<string, boolean>;
export const fetchPrefs = () => get<NotificationPrefs>('/users/notification-preferences');
export const savePrefs = (prefs: NotificationPrefs) => send<NotificationPrefs>('PATCH', '/users/notification-preferences', prefs);

/** Registers this phone for push notifications; the API stores one row per device. */
export const registerPushToken = (token: string) => send('POST', '/users/push-tokens', { token, platform: 'android' });
export const removePushToken = (token: string) => send('DELETE', `/users/push-tokens/${encodeURIComponent(token)}`);
