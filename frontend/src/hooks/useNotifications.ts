'use client';
import { useCallback, useState } from 'react';
import { usePolling } from './usePolling';
import {
  fetchNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
} from '@/lib/api';
import type { Notification } from '@/types';

const POLLING_INTERVAL_MS = 15_000;

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refetch: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [localItems, setLocalItems] = useState<Notification[]>([]);

  const fetcher = useCallback(async () => {
    const items = await fetchNotifications();
    setLocalItems(items);
    return items;
  }, []);

  const { data, loading, error, refetch } = usePolling<Notification[]>(
    fetcher,
    POLLING_INTERVAL_MS,
  );

  const notifications = data ?? localItems;
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await apiMarkRead(id);
    setLocalItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    refetch();
  }

  async function markAllRead() {
    await apiMarkAllRead();
    setLocalItems((prev) => prev.map((n) => ({ ...n, read: true })));
    refetch();
  }

  return { notifications, unreadCount, loading, error, markRead, markAllRead, refetch };
}
