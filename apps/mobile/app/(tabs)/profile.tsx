import { useState } from 'react';
import { useRouter } from 'expo-router';
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
  ShieldCheck,
  FileText,
  Bookmark,
  Bell,
  HelpCircle,
  ExternalLink,
  Lock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth.store';
import Toast from 'react-native-toast-message';

const ROLE_LABELS: Record<string, string> = {
  JOB_SEEKER: 'Job Seeker',
  FREELANCER: 'Freelance Specialist',
  EMPLOYER: 'Verified Employer',
  ADMIN: 'System Admin',
};

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of your Beleqet account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            Toast.show({ type: 'info', text1: 'Signed out successfully' });
          } catch {
            Toast.show({ type: 'error', text1: 'Could not sign out. Please try again.' });
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }

  // Guest State View
  if (!user) {
    return (
      <View className="flex-1 bg-surface">
        <StatusBar barStyle="light-content" backgroundColor="#041603" />
        <View className="bg-primary px-6 pt-16 pb-10 items-center">
          <View className="w-20 h-20 rounded-3xl bg-brandGreen/20 border border-brandGreen/30 items-center justify-center mb-4 shadow-sm">
            <User color="#d8ff3e" size={38} />
          </View>
          <Text className="text-white text-2xl font-black text-center">Your Beleqet Profile</Text>
          <Text className="text-white/60 text-sm text-center mt-2 max-w-xs leading-5">
            Sign in to apply with one tap, track bids, communicate with clients, and manage escrow payments.
          </Text>
        </View>

        <View className="flex-1 px-6 -mt-4 gap-4">
          <View className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 gap-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-brandGreen/20 items-center justify-center">
                <ShieldCheck color="#041603" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">Escrow Protected Contracts</Text>
                <Text className="text-slate-500 text-xs">Work with verified Ethiopian clients safely.</Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-brandGreen/20 items-center justify-center">
                <Sparkles color="#041603" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">Curated Opportunities</Text>
                <Text className="text-slate-500 text-xs">Full-time, remote, and freelance projects.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="bg-primary py-4 rounded-2xl items-center shadow-md active:opacity-90"
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text className="text-brandGreen font-black text-base">Sign In or Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-3.5 items-center"
            onPress={() => router.push('/(tabs)/jobs')}
          >
            <Text className="text-slate-600 font-bold text-sm">Continue Browsing Jobs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Header ── */}
      <View className="bg-primary px-5 pt-14 pb-8 shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
            My Account
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            accessibilityLabel="Notifications"
          >
            <Bell color="#d8ff3e" size={16} />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-4">
          {/* Avatar with initials */}
          <View className="w-16 h-16 bg-brandGreen rounded-2xl items-center justify-center shadow-md">
            <Text className="text-primary text-2xl font-black">{initials}</Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-white text-xl font-black">
                {user.firstName} {user.lastName}
              </Text>
              {user.emailVerified && <CheckCircle2 color="#d8ff3e" size={16} />}
            </View>
            <Text className="text-white/60 text-xs mt-0.5">{user.email}</Text>
            <View className="flex-row items-center gap-2 mt-2">
              <View className="bg-brandGreen/20 border border-brandGreen/30 px-2.5 py-0.5 rounded-full">
                <Text className="text-brandGreen text-[11px] font-bold">{roleLabel}</Text>
              </View>
              {user.emailVerified && (
                <View className="bg-white/10 px-2.5 py-0.5 rounded-full">
                  <Text className="text-white/80 text-[11px] font-semibold">Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Quick Stats Grid ── */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs items-center">
            <Text className="text-slate-400 text-[10px] font-bold uppercase">Profile Status</Text>
            <Text className="text-slate-900 font-black text-lg mt-0.5">Active</Text>
            <Text className="text-emerald-600 text-[10px] font-semibold mt-0.5">Ready for hire</Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs items-center">
            <Text className="text-slate-400 text-[10px] font-bold uppercase">Escrow Protection</Text>
            <Text className="text-brandGreen font-black text-lg mt-0.5">100%</Text>
            <Text className="text-slate-500 text-[10px] font-semibold mt-0.5">BeleqetSafe</Text>
          </View>
        </View>

        {/* ── Personal Info ── */}
        <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs">
          <Text className="text-slate-900 text-xs font-bold uppercase tracking-wider mb-3">
            Contact & Profile Info
          </Text>

          <InfoRow icon={<Mail color="#64748b" size={16} />} label="Email" value={user.email} />
          {user.phone ? (
            <InfoRow icon={<Phone color="#64748b" size={16} />} label="Phone" value={user.phone} />
          ) : null}
          {user.location ? (
            <InfoRow
              icon={<MapPin color="#64748b" size={16} />}
              label="Location"
              value={user.location}
            />
          ) : null}
          <InfoRow
            icon={<Briefcase color="#64748b" size={16} />}
            label="Account Role"
            value={roleLabel}
            last
          />
        </View>

        {/* ── Bio / Summary ── */}
        {user.bio ? (
          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs">
            <Text className="text-slate-900 text-xs font-bold uppercase tracking-wider mb-2">
              Professional Summary
            </Text>
            <Text className="text-slate-600 text-sm leading-6">{user.bio}</Text>
          </View>
        ) : null}

        {/* ── Settings & Security Actions ── */}
        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-xs">
          <Text className="text-slate-900 text-xs font-bold uppercase tracking-wider px-5 pt-4 pb-2">
            Account Preferences
          </Text>

          <ActionRow
            icon={<User color="#64748b" size={18} />}
            label="Edit Profile Details"
            onPress={() =>
              Toast.show({
                type: 'info',
                text1: 'Profile Management',
                text2: 'Full profile editor is available on the web portal at beleqet.com.',
              })
            }
          />
          <ActionRow
            icon={<Lock color="#64748b" size={18} />}
            label="Security & Password"
            onPress={() =>
              Toast.show({
                type: 'info',
                text1: 'Security Settings',
                text2: 'You can update your credentials from the account settings.',
              })
            }
          />
          <ActionRow
            icon={<HelpCircle color="#64748b" size={18} />}
            label="Help & Support"
            onPress={() =>
              Toast.show({
                type: 'info',
                text1: 'Beleqet Support',
                text2: 'Email us at support@beleqetjobs.com for 24/7 assistance.',
              })
            }
            last
          />
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity
          className="bg-red-50 border border-red-200/80 rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-80"
          onPress={handleLogout}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          {loggingOut ? (
            <ActivityIndicator color="#ef4444" size="small" />
          ) : (
            <>
              <LogOut color="#ef4444" size={17} />
              <Text className="text-red-600 font-bold text-sm">Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <View className="items-center pt-2">
          <Text className="text-slate-400 text-xs font-medium">Beleqet Mobile • Version 1.0.0</Text>
          <Text className="text-slate-400 text-[10px] mt-0.5">Empowering Ethiopian Talent</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helper Row Components ───────────────────────────────────────────────────────

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
      className={`flex-row items-center py-3 gap-3.5 ${
        !last ? 'border-b border-slate-100' : ''
      }`}
    >
      <View className="w-8 h-8 rounded-xl bg-slate-50 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-slate-400 text-[10px] font-bold uppercase">{label}</Text>
        <Text className="text-slate-900 text-sm font-semibold mt-0.5">{value}</Text>
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
      className={`flex-row items-center px-5 py-3.5 gap-3.5 active:bg-slate-50 ${
        !last ? 'border-b border-slate-100' : ''
      }`}
      accessibilityRole="button"
    >
      <View className="w-8 h-8 rounded-xl bg-slate-50 items-center justify-center">
        {icon}
      </View>
      <Text className="flex-1 text-slate-800 text-sm font-semibold">{label}</Text>
      <ChevronRight color="#94a3b8" size={16} />
    </TouchableOpacity>
  );
}
