import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Sparkles,
  Building2,
  Check,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth.store';
import type { UserRole } from '@beleqet/common';

interface RoleOption {
  value: UserRole;
  title: string;
  subtitle: string;
  icon: typeof Briefcase;
}

const ROLES: RoleOption[] = [
  {
    value: 'JOB_SEEKER' as UserRole,
    title: 'Job Seeker',
    subtitle: 'Search and apply for full-time & remote careers',
    icon: Briefcase,
  },
  {
    value: 'FREELANCER' as UserRole,
    title: 'Freelancer',
    subtitle: 'Submit proposals & earn with secure escrow milestones',
    icon: Sparkles,
  },
  {
    value: 'EMPLOYER' as UserRole,
    title: 'Employer',
    subtitle: 'Post vacancies, review applicants, and hire talent',
    icon: Building2,
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register, status } = useAuthStore();
  const loading = status === 'loading';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('JOB_SEEKER' as UserRole);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  async function handleRegister() {
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst || !cleanLast || !cleanEmail || !password) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please fill in your name, email, and password.',
      });
      return;
    }

    if (password.length < 8) {
      Toast.show({
        type: 'error',
        text1: 'Weak Password',
        text2: 'Your password must be at least 8 characters long.',
      });
      return;
    }

    try {
      await register({
        firstName: cleanFirst,
        lastName: cleanLast,
        email: cleanEmail,
        password,
        role,
      });
      // AuthGuard will handle redirect to (tabs)/jobs
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: err instanceof Error ? err.message : 'Please check your information and try again.',
      });
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 pt-14 pb-10 justify-between">
          
          {/* Top navigation row */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 active:opacity-75"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft color="#ffffff" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/jobs')}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 active:opacity-75"
              accessibilityRole="button"
              accessibilityLabel="Explore as guest"
            >
              <Text className="text-white/70 text-xs font-semibold">Explore as Guest</Text>
              <ArrowRight color="#d8ff3e" size={13} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View className="mb-6">
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-12 h-12 bg-brandGreen rounded-2xl items-center justify-center shadow-lg shadow-black/20">
                <Text className="text-primary text-2xl font-black">B</Text>
              </View>
              <View>
                <Text className="text-white text-2xl font-black tracking-tight leading-none">
                  Beleqet<Text className="text-brandGreen">.</Text>
                </Text>
                <Text className="text-brandGreen text-[10px] font-black uppercase tracking-wider mt-1">
                  Jobs &amp; Freelance
                </Text>
              </View>
            </View>

            <Text className="text-white text-3xl font-black tracking-tight">
              Create an account
            </Text>
            <Text className="text-white/60 mt-1 text-sm leading-5">
              Connect with thousands of verified Ethiopian employers and freelance clients.
            </Text>
          </View>

          {/* Role Selection Cards */}
          <View className="mb-6">
            <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2.5 ml-1">
              Select Your Profile Type
            </Text>
            <View className="space-y-2.5">
              {ROLES.map((r) => {
                const IconComponent = r.icon;
                const isSelected = role === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setRole(r.value)}
                    activeOpacity={0.8}
                    className={`flex-row items-center p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'border-brandGreen bg-brandGreen/15 shadow-sm'
                        : 'border-white/10 bg-white/5'
                    }`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                        isSelected ? 'bg-brandGreen' : 'bg-white/10'
                      }`}
                    >
                      <IconComponent
                        color={isSelected ? '#041603' : 'rgba(255,255,255,0.7)'}
                        size={20}
                      />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text
                        className={`text-sm font-bold ${
                          isSelected ? 'text-brandGreen' : 'text-white'
                        }`}
                      >
                        {r.title}
                      </Text>
                      <Text className="text-white/40 text-xs mt-0.5 leading-4">
                        {r.subtitle}
                      </Text>
                    </View>
                    <View
                      className={`w-5 h-5 rounded-full items-center justify-center border ${
                        isSelected
                          ? 'border-brandGreen bg-brandGreen'
                          : 'border-white/20 bg-white/5'
                      }`}
                    >
                      {isSelected && <Check color="#041603" size={12} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Form Fields */}
          <View className="space-y-4 mb-6">
            
            {/* First & Last Name row */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                  First Name
                </Text>
                <View
                  className={`flex-row items-center bg-white/10 rounded-2xl px-3.5 border ${
                    focusedInput === 'firstName'
                      ? 'border-brandGreen bg-white/15'
                      : 'border-white/10'
                  }`}
                >
                  <User
                    color={focusedInput === 'firstName' ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                    size={16}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    className="flex-1 text-white py-3.5 text-base"
                    placeholder="Abebe"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={firstName}
                    onChangeText={setFirstName}
                    onFocus={() => setFocusedInput('firstName')}
                    onBlur={() => setFocusedInput(null)}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    returnKeyType="next"
                    accessibilityLabel="First name input"
                  />
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                  Last Name
                </Text>
                <View
                  className={`flex-row items-center bg-white/10 rounded-2xl px-3.5 border ${
                    focusedInput === 'lastName'
                      ? 'border-brandGreen bg-white/15'
                      : 'border-white/10'
                  }`}
                >
                  <User
                    color={focusedInput === 'lastName' ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                    size={16}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    className="flex-1 text-white py-3.5 text-base"
                    placeholder="Kebede"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={lastName}
                    onChangeText={setLastName}
                    onFocus={() => setFocusedInput('lastName')}
                    onBlur={() => setFocusedInput(null)}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    returnKeyType="next"
                    accessibilityLabel="Last name input"
                  />
                </View>
              </View>
            </View>

            {/* Email Field */}
            <View className="mt-3">
              <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                Email Address
              </Text>
              <View
                className={`flex-row items-center bg-white/10 rounded-2xl px-4 border ${
                  focusedInput === 'email' ? 'border-brandGreen bg-white/15' : 'border-white/10'
                }`}
              >
                <Mail
                  color={focusedInput === 'email' ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                  size={18}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className="flex-1 text-white py-4 text-base"
                  placeholder="name@example.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  accessibilityLabel="Email address input"
                />
              </View>
            </View>

            {/* Password Field */}
            <View className="mt-3">
              <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
                Password
              </Text>
              <View
                className={`flex-row items-center bg-white/10 rounded-2xl px-4 border ${
                  focusedInput === 'password'
                    ? 'border-brandGreen bg-white/15'
                    : 'border-white/10'
                }`}
              >
                <Lock
                  color={focusedInput === 'password' ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                  size={18}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className="flex-1 text-white py-4 text-base"
                  placeholder="Min. 8 characters"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff color="rgba(255,255,255,0.6)" size={18} />
                  ) : (
                    <Eye color="rgba(255,255,255,0.4)" size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

          </View>

          {/* Legal agreement disclaimer */}
          <Text className="text-white/40 text-xs text-center mb-5 px-4 leading-4">
            By creating an account, you agree to the{' '}
            <Text className="text-white/70 underline">Terms of Service</Text> and{' '}
            <Text className="text-white/70 underline">Privacy Policy</Text>.
          </Text>

          {/* Create Account Button */}
          <TouchableOpacity
            className="bg-brandGreen rounded-2xl py-4 items-center justify-center active:opacity-90 shadow-md shadow-brandGreen/20"
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Create account button"
          >
            {loading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#041603" size="small" />
                <Text className="text-primary font-black text-base">Creating Account…</Text>
              </View>
            ) : (
              <Text className="text-primary font-black text-base tracking-wide">
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Footer switch to login */}
          <View className="flex-row justify-center items-center mt-6 pt-4 border-t border-white/10">
            <Text className="text-white/60 text-sm">
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity accessibilityRole="link" accessibilityLabel="Sign in">
                <Text className="text-brandGreen text-sm font-black underline">
                  Sign in
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
