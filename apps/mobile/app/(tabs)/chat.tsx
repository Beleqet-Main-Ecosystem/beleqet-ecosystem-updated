import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { Mic, MicOff, Copy, Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { apiClient } from '../../api/client';

type Transcript = { id: string; text: string; createdAt: Date };

export default function ChatScreen() {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  /** Stub: In production use expo-av or expo-audio to record and upload the audio file. */
  async function handleToggleRecording() {
    if (recording) {
      setRecording(false);
      setLoading(true);
      try {
        // In production: upload recorded audio file via multipart/form-data
        // const { data } = await apiClient.post('/chat-to-text/transcribe', formData, {
        //   headers: { 'Content-Type': 'multipart/form-data' },
        // });
        // Simulated response for demo:
        const demo =
          'This is a sample transcription. Connect expo-av to record real audio and upload to /chat-to-text/transcribe.';
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
      Toast.show({ type: 'info', text1: 'Recording…', text2: 'Tap the mic again to stop' });
    }
  }

  function handleCopy(text: string) {
    // expo-clipboard
    Toast.show({ type: 'success', text1: 'Copied to clipboard' });
  }

  function handleClear() {
    Alert.alert('Clear transcripts', 'Remove all transcriptions?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setTranscripts([]) },
    ]);
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
                onPress={() => handleCopy(t.text)}
                className="w-8 h-8 bg-surface rounded-lg items-center justify-center"
                accessibilityLabel="Copy transcript"
              >
                <Copy color="#6b7280" size={14} />
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
