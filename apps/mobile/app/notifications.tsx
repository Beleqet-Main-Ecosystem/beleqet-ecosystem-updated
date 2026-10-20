import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Briefcase, Zap, MessageSquare, ArrowLeft, CheckCheck } from 'lucide-react-native';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type AppNotification,
} from '../api/notifications';

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    await markNotificationAsRead(id);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* Header */}
      <View className="bg-primary px-5 pt-14 pb-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-8 h-8 items-center justify-center rounded-full bg-white/10"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#ffffff" size={18} />
            </TouchableOpacity>
            <Text className="text-white text-xl font-black">Notifications</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              className="flex-row items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full"
              accessibilityLabel="Mark all notifications as read"
            >
              <CheckCheck color="#d8ff3e" size={14} />
              <Text className="text-brandGreen text-xs font-bold">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
          <Text className="text-muted text-sm mt-3">Loading notifications…</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#041603"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24 px-6">
              <View className="w-16 h-16 bg-primary/5 rounded-full items-center justify-center mb-4">
                <Bell color="#6b7280" size={28} />
              </View>
              <Text className="text-slate-800 text-lg font-bold">No notifications</Text>
              <Text className="text-muted text-sm text-center mt-1">
                You're all caught up! New job alerts, bids, and updates will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleMarkRead(item.id)}
              className={`flex-row items-start gap-3 bg-white rounded-2xl p-4 border ${
                item.read ? 'border-black/5 opacity-80' : 'border-brandGreen/40 shadow-xs'
              }`}
              accessibilityRole="button"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.read ? 'bg-primary/5' : 'bg-brandGreen'
                }`}
              >
                {item.type === 'job' && <Briefcase color="#041603" size={16} />}
                {item.type === 'gig' && <Zap color="#041603" size={16} />}
                {item.type === 'message' && <MessageSquare color="#041603" size={16} />}
                {item.type !== 'job' && item.type !== 'gig' && item.type !== 'message' && (
                  <Bell color="#041603" size={16} />
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm font-bold ${item.read ? 'text-slate-600' : 'text-slate-900'}`}>
                    {item.title}
                  </Text>
                  <Text className="text-muted/60 text-xs">
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text className="text-muted text-xs mt-1 leading-5">{item.body}</Text>
              </View>
              {!item.read && <View className="w-2.5 h-2.5 rounded-full bg-brandGreen mt-1.5" />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
