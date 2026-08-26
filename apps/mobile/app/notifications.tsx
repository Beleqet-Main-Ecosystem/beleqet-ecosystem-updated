import {
  View,
  Text,
  FlatList,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Briefcase, Zap, MessageSquare, ArrowLeft } from 'lucide-react-native';

// Static demo notifications — replace with live GET /notifications once endpoint is ready
const DEMO_NOTIFICATIONS = [
  {
    id: '1',
    type: 'job',
    title: 'New job match',
    body: 'Senior React Native Developer at Kifiya Financial Technology',
    time: '2h ago',
    read: false,
  },
  {
    id: '2',
    type: 'gig',
    title: 'Proposal received',
    body: 'A freelancer submitted a proposal on your "Logo & Brand Identity" project',
    time: '5h ago',
    read: false,
  },
  {
    id: '3',
    type: 'message',
    title: 'New message',
    body: 'Ethio Telecom HR replied to your job application',
    time: '1d ago',
    read: true,
  },
  {
    id: '4',
    type: 'job',
    title: 'Application viewed',
    body: 'Your application for UX Designer at Safaricom Ethiopia was viewed',
    time: '2d ago',
    read: true,
  },
];

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* Header */}
      <View className="bg-primary px-5 pt-14 pb-5">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#ffffff" size={20} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Notifications</Text>
        </View>
      </View>

      <FlatList
        data={DEMO_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-primary/5 rounded-full items-center justify-center mb-4">
              <Bell color="#6b7280" size={28} />
            </View>
            <Text className="text-ink font-bold">No notifications</Text>
            <Text className="text-muted text-sm mt-1">You're all caught up!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`flex-row items-start gap-3 bg-white rounded-2xl p-4 border ${
              item.read ? 'border-black/5' : 'border-brandGreen/30'
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
              {item.type === 'other' && <Bell color="#041603" size={16} />}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm font-bold ${item.read ? 'text-muted' : 'text-ink'}`}>
                  {item.title}
                </Text>
                <Text className="text-muted/60 text-xs">{item.time}</Text>
              </View>
              <Text className="text-muted text-xs mt-1 leading-5">{item.body}</Text>
            </View>
            {!item.read && <View className="w-2 h-2 rounded-full bg-brandGreen mt-1.5" />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
