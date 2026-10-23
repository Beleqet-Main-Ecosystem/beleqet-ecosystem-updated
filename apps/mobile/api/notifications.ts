import { apiClient } from './client';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

/** Fetch all user notifications from the backend. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  try {
    const { data } = await apiClient.get<AppNotification[]>('/users/notifications');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Mark a single notification as read. */
export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    await apiClient.patch(`/users/notifications/${id}/read`);
  } catch {
    // best-effort
  }
}

/** Mark all notifications as read. */
export async function markAllNotificationsAsRead(): Promise<void> {
  try {
    await apiClient.patch('/users/notifications/read-all');
  } catch {
    // best-effort
  }
}
