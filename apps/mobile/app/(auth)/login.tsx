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

export default function LoginScreen() {
  const { login, status } = useAuthStore();
  const loading = status === 'loading';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Please fill in all fields' });
      return;
    }
    try {
      await login({ email: email.trim().toLowerCase(), password });
      // AuthGuard in _layout.tsx handles redirect to (tabs)/jobs
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: err instanceof Error ? err.message : 'Please try again',
      });
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-primary"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-10 justify-center">
          {/* Logo / Brand */}
          <View className="mb-10">
            <View className="w-14 h-14 bg-brandGreen rounded-2xl items-center justify-center mb-4">
              <Text className="text-primary text-2xl font-black">B</Text>
            </View>
            <Text className="text-white text-3xl font-black tracking-tight">
              Welcome back
            </Text>
            <Text className="text-white/50 mt-2 text-base">
              Sign in to your Beleqet account
            </Text>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-white/70 text-sm font-semibold mb-2">
              Email address
            </Text>
            <TextInput
              className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10"
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              accessibilityLabel="Email address"
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-white/70 text-sm font-semibold mb-2">
              Password
            </Text>
            <View className="relative">
              <TextInput
                className="bg-white/10 text-white rounded-2xl px-4 py-4 text-base border border-white/10 pr-14"
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                className="absolute right-4 top-4"
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text className="text-white/50 text-sm">
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            className="bg-brandGreen rounded-2xl py-4 items-center active:opacity-80"
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator color="#041603" />
            ) : (
              <Text className="text-primary font-black text-base">
                Sign In
              </Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-white/50 text-sm">
              Don&apos;t have an account?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity accessibilityRole="link">
                <Text className="text-brandGreen text-sm font-bold">
                  Sign up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
