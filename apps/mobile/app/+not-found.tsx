import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Home } from 'lucide-react-native';

/**
 * 404 fallback screen for unmatched routes.
 * Handles broken deep links and invalid push notification targets.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-surface items-center justify-center px-8">
      <Text className="text-6xl font-black text-primary mb-4">404</Text>
      <Text className="text-ink text-lg font-bold">Page not found</Text>
      <Text className="text-muted text-sm text-center mt-2">
        The page you're looking for doesn't exist or has been moved.
      </Text>
      <TouchableOpacity
        className="flex-row items-center gap-2 bg-primary px-6 py-3 rounded-full mt-6"
        onPress={() => router.replace('/(tabs)/jobs')}
      >
        <Home color="#d8ff3e" size={16} />
        <Text className="text-brandGreen font-bold text-base">Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}
