import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  LogOut,
  User,
  Mail,
  MapPin,
  Phone,
  Briefcase,
  ChevronRight,
  Shield,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import Toast from 'react-native-toast-message';

const ROLE_LABELS: Record<string, string> = {
  JOB_SEEKER: 'Job Seeker',
  FREELANCER: 'Freelancer',
  EMPLOYER: 'Employer',
  ADMIN: 'Admin',
};

export default function ProfileScreen() {
  const { user, logout, status } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch {
            Toast.show({ type: 'error', text1: 'Could not sign out. Try again.' });
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* Header */}
      <View className="bg-primary px-5 pt-14 pb-8">
        <Text className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
          Profile
        </Text>
        <View className="flex-row items-center gap-4">
          {/* Avatar */}
          <View className="w-16 h-16 bg-brandGreen rounded-full items-center justify-center">
            <Text className="text-primary text-2xl font-black">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-lg font-black">
              {user.firstName} {user.lastName}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <View className="bg-brandGreen/20 px-2 py-0.5 rounded-full">
                <Text className="text-brandGreen text-xs font-bold">{roleLabel}</Text>
              </View>
              {user.isEmailVerified && (
                <View className="bg-blue-500/20 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                  <Shield color="#60a5fa" size={10} />
                  <Text className="text-blue-400 text-xs font-bold">Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Info card */}
        <View className="bg-white rounded-2xl overflow-hidden border border-black/5">
          <Text className="text-xs font-bold uppercase tracking-widest text-muted px-4 pt-4 pb-2">
            Account info
          </Text>

          <InfoRow icon={<Mail color="#6b7280" size={16} />} label="Email" value={user.email} />
          {user.phone && (
            <InfoRow icon={<Phone color="#6b7280" size={16} />} label="Phone" value={user.phone} />
          )}
          {user.location && (
            <InfoRow
              icon={<MapPin color="#6b7280" size={16} />}
              label="Location"
              value={user.location}
            />
          )}
          <InfoRow
            icon={<Briefcase color="#6b7280" size={16} />}
            label="Role"
            value={roleLabel}
            last
          />
        </View>

        {/* Bio */}
        {user.bio && (
          <View className="bg-white rounded-2xl p-4 border border-black/5">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
              Bio
            </Text>
            <Text className="text-ink text-sm leading-6">{user.bio}</Text>
          </View>
        )}

        {/* Actions */}
        <View className="bg-white rounded-2xl overflow-hidden border border-black/5">
          <ActionRow
            icon={<User color="#6b7280" size={16} />}
            label="Edit Profile"
            onPress={() => Toast.show({ type: 'info', text1: 'Coming soon' })}
          />
          <ActionRow
            icon={<Shield color="#6b7280" size={16} />}
            label="Change Password"
            onPress={() => Toast.show({ type: 'info', text1: 'Coming soon' })}
            last
          />
        </View>

        {/* Sign out */}
        <TouchableOpacity
          className="bg-red-50 border border-red-100 rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          {loggingOut ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <>
              <LogOut color="#ef4444" size={16} />
              <Text className="text-red-500 font-bold text-sm">Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text className="text-center text-muted/40 text-xs pb-4">
          Beleqet Jobs v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-3 gap-3 ${
        !last ? 'border-b border-black/5' : ''
      }`}
    >
      {icon}
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className="text-ink text-sm font-semibold mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-4 py-4 gap-3 active:bg-black/5 ${
        !last ? 'border-b border-black/5' : ''
      }`}
      accessibilityRole="button"
    >
      {icon}
      <Text className="flex-1 text-ink text-sm font-semibold">{label}</Text>
      <ChevronRight color="#d1d5db" size={16} />
    </TouchableOpacity>
  );
}
