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
} from 'react-native';
import { Link } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth.store';

type Role = 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER';

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'JOB_SEEKER', label: 'Job Seeker', description: 'Find full-time & part-time jobs' },
  { value: 'FREELANCER', label: 'Freelancer', description: 'Offer skills & find gig projects' },
  { value: 'EMPLOYER', label: 'Employer', description: 'Post jobs & hire talent' },
];

export default function RegisterScreen() {
  const { register, status } = useAuthStore();
  const loading = status === 'loading';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('JOB_SEEKER');

  async function handleRegister() {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Please fill in all fields' });
      return;
    }
    if (password.length < 8) {
      Toast.show({ type: 'error', text1: 'Password must be at least 8 characters' });
      return;
    }
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Registration failed',
        text2: err instanceof Error ? err.message : 'Please try again',
      });
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-16 pb-10">
          {/* Header */}
          <View className="mb-8">
            <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center mb-4">
              <Text className="text-primary text-2xl font-black">B</Text>
            </View>
            <Text className="text-white text-3xl font-black tracking-tight">Create account</Text>
            <Text className="text-white/50 mt-2 text-base">
              Join thousands of Ethiopians on Beleqet
            </Text>
          </View>

          {/* Role selector */}
          <View className="mb-6">
            <Text className="text-white/70 text-sm font-semibold mb-3">I am a…</Text>
            <View className="gap-2">
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  className={`flex-row items-center p-4 rounded-2xl border ${
                    role === r.value
                      ? 'border-brandGreen bg-brandGreen/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === r.value }}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                      role === r.value ? 'border-brandGreen' : 'border-white/30'
                    }`}
                  >
                    {role === r.value && (
                      <View className="w-2.5 h-2.5 rounded-full bg-brandGreen" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-bold ${
                        role === r.value ? 'text-brandGreen' : 'text-white'
                      }`}
                    >
                      {r.label}
                    </Text>
                    <Text className="text-white/40 text-xs mt-0.5">{r.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Name row */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1">
              <Text className="text-white/70 text-sm font-semibold mb-2">First name</Text>
              <TextInput
                className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10"
                placeholder="Abebe"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                accessibilityLabel="First name"
              />
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-sm font-semibold mb-2">Last name</Text>
              <TextInput
                className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10"
                placeholder="Kebede"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                accessibilityLabel="Last name"
              />
            </View>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-white/70 text-sm font-semibold mb-2">Email address</Text>
            <TextInput
              className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-white/70 text-sm font-semibold mb-2">Password</Text>
            <View className="relative">
              <TextInput
                className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10 pr-14"
                placeholder="Min. 8 characters"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                className="absolute right-4 top-4"
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text className="text-white/50 text-sm">{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            className="bg-brandGreen rounded-2xl py-4 items-center active:opacity-80"
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            {loading ? (
              <ActivityIndicator color="#041603" />
            ) : (
              <Text className="text-primary font-black text-base">Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-white/50 text-sm">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity accessibilityRole="link">
                <Text className="text-brandGreen text-sm font-bold">Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
