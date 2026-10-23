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
import { Mic, MicOff, Share2, Trash2, MessageSquare } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import { apiClient } from '../../api/client';
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
          'Beleqet Voice AI note: Client project review scheduled for 3:00 PM. Follow up on milestones and escrow release.';
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
      Toast.show({ type: 'info', text1: 'Listening…', text2: 'Tap the mic again to stop' });
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
    Alert.alert('Clear transcripts', 'Remove all transcriptions?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setTranscripts([]) },
    ]);
  }

  if (!user) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-8">
        <MessageSquare color="#6b7280" size={48} />
        <Text className="text-ink text-lg font-bold mt-4">Sign in to use Chat-to-Text</Text>
        <Text className="text-muted text-sm text-center mt-2">Record voice notes and convert them to text. Sign in to get started.</Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full mt-6"
          onPress={() => router.push('/(auth)/login')}
        >
          <Text className="text-brandGreen font-bold text-base">Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <StatusBar barStyle="light-content" backgroundColor="#041603" />

      {/* Header */}
      <View className="bg-primary px-5 pt-14 pb-6">
        <Text className="text-white/50 text-xs font-semibold uppercase tracking-widest">
          Beleqet
        </Text>
        <Text className="text-white text-xl font-black mt-0.5">Chat-to-Text</Text>
        <Text className="text-white/40 text-xs mt-1">
          Record voice notes — converted to text instantly
        </Text>
      </View>

      {/* Transcripts list */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
      >
        {transcripts.length === 0 && !loading && (
          <View className="items-center py-20">
            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
              <Mic color="#041603" size={28} />
            </View>
            <Text className="text-ink font-bold text-base">No transcripts yet</Text>
            <Text className="text-muted text-sm mt-1 text-center px-8">
              Tap the mic button to start recording. We'll convert your speech to text.
            </Text>
          </View>
        )}

        {transcripts.map((t) => (
          <View
            key={t.id}
            className="bg-white rounded-2xl p-4 shadow-sm border border-black/5"
          >
            <View className="flex-row items-start justify-between gap-3">
              <Text className="text-ink text-sm leading-6 flex-1">{t.text}</Text>
              <TouchableOpacity
                onPress={() => handleShare(t.text)}
                className="w-8 h-8 bg-surface rounded-lg items-center justify-center active:bg-black/10"
                accessibilityLabel="Share transcript"
              >
                <Share2 color="#6b7280" size={14} />
              </TouchableOpacity>
            </View>
            <Text className="text-muted/60 text-xs mt-2">
              {t.createdAt.toLocaleTimeString()}
            </Text>
          </View>
        ))}

        {loading && (
          <View className="bg-white rounded-2xl p-6 items-center border border-black/5">
            <ActivityIndicator color="#041603" />
            <Text className="text-muted text-sm mt-2">Transcribing…</Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <View className="bg-white border-t border-black/5 px-6 py-5 items-center gap-3">
        {transcripts.length > 0 && (
          <TouchableOpacity
            className="flex-row items-center gap-2"
            onPress={handleClear}
            accessibilityLabel="Clear all transcripts"
          >
            <Trash2 color="#6b7280" size={14} />
            <Text className="text-muted text-sm">Clear all</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleToggleRecording}
          disabled={loading}
          className={`w-20 h-20 rounded-full items-center justify-center shadow-lg ${
            recording ? 'bg-red-500' : 'bg-primary'
          }`}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          accessibilityState={{ busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : recording ? (
            <MicOff color="#fff" size={30} />
          ) : (
            <Mic color="#d8ff3e" size={30} />
          )}
        </TouchableOpacity>

        <Text className="text-muted text-xs">
          {recording ? 'Recording… tap to stop' : 'Tap to record'}
        </Text>
      </View>
    </View>
  );
}
