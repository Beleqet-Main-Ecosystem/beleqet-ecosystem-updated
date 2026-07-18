
import { useRef, useCallback } from 'react';
import { transcribeAudio, transcribeStreamChunk, getChatToTextErrorMessage } from '@/lib/chat-to-text-api';
import { useTranscriptionStore } from '@/store/transcription.store';

export function useTranscription() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);

  const {
    conversationId,
    selectedLanguage,
    addTranscript,
    setError,
    clearError,
    setIsLoading,
  } = useTranscriptionStore();

  const handleTranscription = useCallback(async () => {
    const currentConversationId = conversationId.trim();
    if (!currentConversationId || audioChunksRef.current.length === 0) {
      return;
    }

    setIsLoading(true);
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const transcript = await transcribeAudio(
        currentConversationId,
        selectedLanguage,
        audioBlob,
      );
      addTranscript(transcript);
      audioChunksRef.current = [];
    } catch (error) {
      setError(getChatToTextErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, selectedLanguage, addTranscript, setError, setIsLoading]);

  const transcribeUploadedFile = useCallback(async (file: File) => {
    const currentConversationId = conversationId.trim();
    if (!currentConversationId) {
      setError('Enter or create a conversation ID before uploading audio.');
      return false;
    }

    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file to upload.');
      return false;
    }

    clearError();
    setIsLoading(true);
    try {
      const transcript = await transcribeAudio(currentConversationId, selectedLanguage, file);
      addTranscript(transcript);
      return true;
    } catch (error) {
      setError(getChatToTextErrorMessage(error));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [addTranscript, clearError, conversationId, selectedLanguage, setError, setIsLoading]);

  const sendStreamChunk = useCallback(async () => {
    const currentConversationId = conversationId.trim();
    if (!currentConversationId || audioChunksRef.current.length === 0 || !isRecordingRef.current) {
      return;
    }

    const pendingChunks = [...audioChunksRef.current];
    audioChunksRef.current = [];

    try {
      const chunkBlob = new Blob(pendingChunks, { type: 'audio/webm' });
      const transcript = await transcribeStreamChunk(
        currentConversationId,
        selectedLanguage,
        chunkBlob,
      );
      addTranscript(transcript);
    } catch (error) {
      setError(getChatToTextErrorMessage(error));
    }
  }, [conversationId, selectedLanguage, addTranscript, setError]);

  const startRecording = useCallback(async () => {
    if (!conversationId.trim()) {
      setError('Enter or create a conversation ID before recording.');
      return false;
    }

    try {
      clearError();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        if (chunkTimerRef.current !== null) {
          window.clearInterval(chunkTimerRef.current);
          chunkTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        await handleTranscription();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      isRecordingRef.current = true;
      chunkTimerRef.current = window.setInterval(() => {
        void sendStreamChunk();
      }, 1500);
      useTranscriptionStore.setState({});
      return true;
    } catch {
      setError('Failed to access microphone. Please check permissions.');
      return false;
    }
  }, [conversationId, clearError, setError, handleTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      if (chunkTimerRef.current !== null) {
        window.clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      useTranscriptionStore.setState({});
    }
  }, []);

  return {
    startRecording,
    stopRecording,
    transcribeUploadedFile,
    get isRecording() {
      return isRecordingRef.current;
    },
  };
}
