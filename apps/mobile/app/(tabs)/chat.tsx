import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
  Share,
} from 'react-native';
import {
  Mic,
  MicOff,
  Share2,
  Trash2,
  Sparkles,
  Clock,
} from 'lucide-react-native';
import { format } from 'date-fns';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';

type Transcript = { id: string; text: string; createdAt: Date };

export default function ChatScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  async function handleToggleRecording() {
    if (recording) {
      setRecording(false);
      setLoading(true);
      try {
        const demo =
          'Beleqet Voice Note: Discussed project timeline with client. Deliverables scheduled for Friday with escrow release upon milestone review.';
        setTranscripts((prev) => [
          ...prev,
          { id: Date.now().toString(), text: demo, createdAt: new Date() },
        ]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      } catch {
        Toast.show({ type: 'error', text1: 'Transcription failed', text2: 'Please try again' });
      } finally {
        setLoading(false);
      }
    } else {
      setRecording(true);
      Toast.show({ type: 'info', text1: 'Recording audio…', text2: 'Tap the red button to finish' });
    }
  }

  async function handleShare(text: string) {
    try {
      await Share.share({ message: text });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not share transcription' });
    }
  }

  function handleClear() {
    Alert.alert('Clear All Transcripts', 'Are you sure you want to remove all voice notes?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => setTranscripts([]) },
    ]);
  }

  if (!user) {
    return (
      <View className="flex-1 bg-surface">
        <StatusBar barStyle="light-content" backgroundColor="#041603" />
        <View className="bg-primary px-6 pt-16 pb-10 items-center">
          <View className="w-20 h-20 rounded-3xl bg-brandGreen/20 border border-brandGreen/30 items-center justify-center mb-4 shadow-sm">
            <Mic color="#d8ff3e" size={38} />
          </View>
          <Text className="text-white text-2xl font-black text-center">Chat-to-Text AI</Text>
          <Text className="text-white/60 text-sm text-center mt-2 max-w-xs leading-5">
            Record voice notes, interviews, and proposal drafts. Transcribe instantly in English and Amharic.
          </Text>
        </View>

        <View className="flex-1 px-6 -mt-4 gap-4">
          <View className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 gap-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-brandGreen/20 items-center justify-center">
                <Sparkles color="#041603" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">Instant Speech-to-Text</Text>
                <Text className="text-slate-500 text-xs">Accurate AI transcription for meeting notes.</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-brandGreen/20 items-center justify-center">
                <Share2 color="#041603" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-bold text-sm">Easy Export</Text>
                <Text className="text-slate-500 text-xs">Share transcripts directly with clients.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="bg-primary py-4 rounded-2xl items-center shadow-md active:opacity-90"
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text className="text-brandGreen font-black text-base">Sign In to Use Voice AI</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* ── Top Header ── */}
      <View className="bg-primary px-5 pt-14 pb-5 shadow-md">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
              AI Tools
            </Text>
            <Text className="text-white text-xl font-black">Chat-to-Text</Text>
            <Text className="text-white/50 text-xs mt-0.5">
              Record voice notes & transcribe speech to text
            </Text>
          </View>

          {transcripts.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center active:opacity-75"
              accessibilityLabel="Clear transcripts"
            >
              <Trash2 color="#ffffff" size={17} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Transcripts List ── */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ gap: 12, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {transcripts.length === 0 && !loading && (
          <View className="items-center py-20 px-6">
            <View className="w-18 h-18 bg-primary/10 rounded-3xl items-center justify-center mb-4">
              <Mic color="#041603" size={32} />
            </View>
            <Text className="text-slate-900 font-bold text-lg text-center">
              No Voice Transcripts Yet
            </Text>
            <Text className="text-slate-500 text-sm text-center mt-1.5 max-w-xs leading-5">
              Tap the microphone below to start dictating. Your spoken words will be converted into clean, editable text.
            </Text>
          </View>
        )}

        {transcripts.map((t) => (
          <View
            key={t.id}
            className="bg-white rounded-3xl p-5 shadow-xs border border-slate-100"
          >
            <View className="flex-row items-start justify-between gap-3">
              <Text className="text-slate-800 text-sm leading-6 flex-1 font-medium">
                {t.text}
              </Text>
              <TouchableOpacity
                onPress={() => handleShare(t.text)}
                className="w-9 h-9 bg-slate-50 rounded-xl items-center justify-center active:bg-slate-100"
                accessibilityLabel="Share transcript"
              >
                <Share2 color="#64748b" size={16} />
              </TouchableOpacity>
            </View>
            <View className="flex-row items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
              <Clock color="#94a3b8" size={12} />
              <Text className="text-slate-400 text-[11px] font-medium">
                {format(t.createdAt, 'hh:mm a')}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View className="bg-white rounded-3xl p-6 items-center border border-slate-100 shadow-xs">
            <ActivityIndicator color="#041603" size="small" />
            <Text className="text-slate-600 text-sm font-semibold mt-2.5">
              Transcribing audio with Beleqet AI…
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Record Controls ── */}
      <View className="bg-white border-t border-slate-100 px-6 py-5 items-center gap-2 shadow-lg">
        <TouchableOpacity
          onPress={handleToggleRecording}
          disabled={loading}
          className={`w-20 h-20 rounded-full items-center justify-center shadow-lg active:scale-95 transition-all ${
            recording ? 'bg-red-500' : 'bg-primary'
          }`}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          accessibilityState={{ busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : recording ? (
            <MicOff color="#ffffff" size={32} />
          ) : (
            <Mic color="#d8ff3e" size={32} />
          )}
        </TouchableOpacity>

        <Text className="text-slate-500 text-xs font-semibold">
          {recording ? 'Recording… tap to complete' : 'Tap microphone to speak'}
        </Text>
      </View>
    </View>
  );
}
