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
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { requestPasswordReset } from '../../api/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);

  async function handleResetRequest() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Toast.show({
        type: 'error',
        text1: 'Email Required',
        text2: 'Please enter your registered email address.',
      });
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(cleanEmail);
      setSubmitted(true);
      Toast.show({
        type: 'success',
        text1: 'Email Sent',
        text2: 'Check your inbox for password reset instructions.',
      });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Request Failed',
        text2: err instanceof Error ? err.message : 'Could not send reset email. Please try again.',
      });
    } finally {
      setLoading(false);
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
          
          {/* Top Back Button */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/10 active:opacity-75"
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <ArrowLeft color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View className="flex-1 justify-center">
            <View className="w-16 h-16 bg-brandGreen/15 rounded-3xl items-center justify-center border border-brandGreen/30 mb-6">
              {submitted ? (
                <CheckCircle2 color="#d8ff3e" size={32} />
              ) : (
                <Mail color="#d8ff3e" size={32} />
              )}
            </View>

            <Text className="text-white text-3xl font-black tracking-tight">
              {submitted ? 'Check your email' : 'Reset password'}
            </Text>

            <Text className="text-white/60 mt-2 text-sm leading-6">
              {submitted
                ? `We sent password reset instructions to ${email.trim()}. Please check your spam folder if it doesn't arrive within 2 minutes.`
                : 'Enter your account email address and we will send you instructions to securely reset your password.'}
            </Text>

            {!submitted ? (
              <View className="mt-8 mb-6">
                <Text className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2 ml-1">
                  Registered Email Address
                </Text>
                <View
                  className={`flex-row items-center bg-white/10 rounded-2xl px-4 border ${
                    focused ? 'border-brandGreen bg-white/15' : 'border-white/10'
                  }`}
                >
                  <Mail
                    color={focused ? '#d8ff3e' : 'rgba(255,255,255,0.4)'}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    className="flex-1 text-white py-4 text-base"
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={handleResetRequest}
                    accessibilityLabel="Email address input"
                  />
                </View>

                <TouchableOpacity
                  className="bg-brandGreen rounded-2xl py-4 items-center justify-center mt-6 active:opacity-90 shadow-md shadow-brandGreen/20"
                  onPress={handleResetRequest}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Send reset link"
                >
                  {loading ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator color="#041603" size="small" />
                      <Text className="text-primary font-black text-base">Sending Link…</Text>
                    </View>
                  ) : (
                    <Text className="text-primary font-black text-base tracking-wide">
                      Send Reset Instructions
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mt-8">
                <TouchableOpacity
                  className="bg-brandGreen rounded-2xl py-4 items-center justify-center active:opacity-90"
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text className="text-primary font-black text-base">Return to Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="py-3 items-center justify-center mt-3"
                  onPress={() => setSubmitted(false)}
                >
                  <Text className="text-white/60 text-xs font-semibold">
                    Didn't receive it? Try another email
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Footer link */}
          <View className="flex-row justify-center items-center mt-6 pt-4 border-t border-white/10">
            <Text className="text-white/60 text-sm">Remembered your password? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-brandGreen text-sm font-black underline">Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
