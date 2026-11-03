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
import {
  Bell,
  Briefcase,
  Zap,
  MessageSquare,
  ArrowLeft,
  CheckCheck,
} from 'lucide-react-native';
import { useAuthStore } from '../store/auth.store';
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
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMarkRead = async (item: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    await markNotificationAsRead(item.id);

    // Navigate to target if relevant
    const targetId = (item.data as any)?.jobId ?? (item.data as any)?.gigId ?? (item.data as any)?.id;
    const typeUpper = (item.type || '').toUpperCase();
    if (typeUpper.includes('JOB') && targetId) {
      router.push(`/job/${targetId}`);
    } else if ((typeUpper.includes('GIG') || typeUpper.includes('BID')) && targetId) {
      router.push(`/gig/${targetId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsAsRead();
  };

  if (!user) {
    return (
      <View className="flex-1 bg-surface">
        <StatusBar barStyle="light-content" backgroundColor="#041603" />
        <View className="bg-primary px-5 pt-14 pb-5 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/jobs'))}
            className="w-10 h-10 items-center justify-center rounded-2xl bg-white/10 active:opacity-75"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#ffffff" size={20} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Notifications</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-4">
            <Bell color="#041603" size={28} />
          </View>
          <Text className="text-slate-900 font-bold text-lg text-center">Sign in for Notifications</Text>
          <Text className="text-slate-500 text-sm text-center mt-1.5 mb-6 max-w-xs leading-5">
            Log in to your account to receive alerts on application status, bid updates, and messages.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            className="bg-primary px-7 py-3.5 rounded-full shadow-sm"
            accessibilityRole="button"
          >
            <Text className="text-brandGreen font-bold text-sm">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Header ── */}
      <View className="bg-primary px-5 pt-14 pb-5 shadow-md">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/jobs'))}
              className="w-10 h-10 items-center justify-center rounded-2xl bg-white/10 active:opacity-75"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#ffffff" size={20} />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-black">Notifications</Text>
              <Text className="text-white/50 text-xs">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
              </Text>
            </View>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              className="flex-row items-center gap-1.5 bg-brandGreen px-3.5 py-2 rounded-2xl shadow-sm active:opacity-85"
              accessibilityLabel="Mark all notifications as read"
            >
              <CheckCheck color="#041603" size={15} />
              <Text className="text-primary text-xs font-black">Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#041603" size="large" />
          <Text className="text-slate-500 text-sm mt-3 font-semibold">Loading notifications…</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#041603"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-24 px-6">
              <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-4">
                <Bell color="#041603" size={28} />
              </View>
              <Text className="text-slate-900 text-lg font-bold text-center">No Notifications Yet</Text>
              <Text className="text-slate-500 text-sm text-center mt-1.5 max-w-xs leading-5">
                You're all caught up! Updates regarding your job applications, client proposals, and escrow releases will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleMarkRead(item)}
              className={`flex-row items-start gap-3.5 bg-white rounded-2xl p-4 border transition-all ${
                item.read ? 'border-slate-100 opacity-75' : 'border-brandGreen/50 shadow-xs'
              }`}
              accessibilityRole="button"
            >
              <View
                className={`w-11 h-11 rounded-2xl items-center justify-center ${
                  item.read ? 'bg-slate-100' : 'bg-brandGreen'
                }`}
              >
                {item.type === 'job' && <Briefcase color="#041603" size={18} />}
                {item.type === 'gig' && <Zap color="#041603" size={18} />}
                {item.type === 'message' && <MessageSquare color="#041603" size={18} />}
                {item.type !== 'job' && item.type !== 'gig' && item.type !== 'message' && (
                  <Bell color="#041603" size={18} />
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className={`text-sm font-bold ${item.read ? 'text-slate-600' : 'text-slate-900'}`}>
                    {item.title}
                  </Text>
                  <Text className="text-slate-400 text-[11px] font-medium">
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                <Text className="text-slate-500 text-xs mt-1 leading-5">{item.body}</Text>
              </View>

              {!item.read && <View className="w-2.5 h-2.5 rounded-full bg-brandGreen mt-1.5" />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
