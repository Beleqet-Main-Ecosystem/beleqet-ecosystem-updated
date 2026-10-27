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
import { Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const { login, status } = useAuthStore();
  const loading = status === 'loading';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please enter both your email and password.',
      });
      return;
    }
    try {
      await login({ email: cleanEmail, password });
      // AuthGuard redirects to (tabs)/jobs automatically
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: err instanceof Error ? err.message : 'Invalid credentials. Please try again.',
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
          <View className="flex-row items-center justify-between mb-8">
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

          {/* Header & Logo */}
          <View className="mb-8">
            <View className="flex-row items-center gap-3 mb-4">
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
              Welcome back
            </Text>
            <Text className="text-white/60 mt-1.5 text-sm leading-5">
              Sign in to manage your job applications, proposals, and verified client messages.
            </Text>
          </View>

          {/* Form Fields */}
          <View className="space-y-4 mb-6">
            
            {/* Email Field */}
            <View>
              <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
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
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-2 ml-1">
                <Text className="text-white/80 text-xs font-bold uppercase tracking-wider">
                  Password
                </Text>
                <Link href={"/(auth)/forgot-password" as never} asChild>
                  <TouchableOpacity accessibilityRole="link" accessibilityLabel="Forgot password">
                    <Text className="text-brandGreen text-xs font-bold">
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View
                className={`flex-row items-center bg-white/10 rounded-2xl px-4 border ${
                  focusedInput === 'password' ? 'border-brandGreen bg-white/15' : 'border-white/10'
                }`}
              >
                <Lock
                  color={focusedInput === 'password' ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                  size={18}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className="flex-1 text-white py-4 text-base"
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
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

          {/* Sign In Button */}
          <View className="space-y-4">
            <TouchableOpacity
              className="bg-brandGreen rounded-2xl py-4 items-center justify-center active:opacity-90 shadow-md shadow-brandGreen/20"
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Sign in button"
            >
              {loading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="#041603" size="small" />
                  <Text className="text-primary font-black text-base">Signing In…</Text>
                </View>
              ) : (
                <Text className="text-primary font-black text-base tracking-wide">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Escrow assurance micro-badge */}
            <View className="flex-row items-center justify-center gap-1.5 py-1">
              <Sparkles color="#d8ff3e" size={13} />
              <Text className="text-white/40 text-xs">
                Protected by verified employer screening &amp; Escrow
              </Text>
            </View>
          </View>

          {/* Footer switch to register */}
          <View className="flex-row justify-center items-center mt-6 pt-4 border-t border-white/10">
            <Text className="text-white/60 text-sm">
              New to Beleqet?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity accessibilityRole="link" accessibilityLabel="Sign up">
                <Text className="text-brandGreen text-sm font-black underline">
                  Create an account
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
