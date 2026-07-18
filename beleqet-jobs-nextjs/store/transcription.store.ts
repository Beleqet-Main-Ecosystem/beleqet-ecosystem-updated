import { create } from 'zustand';
import type { ITranscript } from '@/lib/chat-to-text-types';
import {
  createSpeechConversation,
  deleteTranscript as deleteTranscriptApi,
  fetchConversationTranscripts,
  getChatToTextErrorMessage,
} from '@/lib/chat-to-text-api';

const CONVERSATION_ID_STORAGE_KEY = 'beleqet.chat-to-text.conversation-id';
const THEME_STORAGE_KEY = 'beleqet-theme';

interface ITranscriptionState {
  conversationId: string;
  selectedLanguage: string;
  transcripts: ITranscript[];
  isLoading: boolean;
  error: string | null;
  setConversationId: (id: string) => void;
  setSelectedLanguage: (language: string) => void;
  clearError: () => void;
  setError: (error: string) => void;
  setIsLoading: (loading: boolean) => void;
  addTranscript: (transcript: ITranscript) => void;
  fetchTranscripts: () => Promise<void>;
  deleteTranscript: (id: string) => Promise<void>;
  createConversation: () => Promise<void>;
}

export const useTranscriptionStore = create<ITranscriptionState>((set, get) => ({
  conversationId: '',
  selectedLanguage: 'en',
  transcripts: [],
  isLoading: false,
  error: null,

  setConversationId: (id: string) => {
    const trimmed = id.trim();
    if (trimmed) {
      localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(CONVERSATION_ID_STORAGE_KEY);
    }
    set({ conversationId: id });
  },

  setSelectedLanguage: (language: string) => set({ selectedLanguage: language }),
  clearError: () => set({ error: null }),
  setError: (error: string) => set({ error }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),

  addTranscript: (transcript: ITranscript) => {
    set((state) => ({ transcripts: [transcript, ...state.transcripts] }));
  },

  fetchTranscripts: async () => {
    const { conversationId } = get();
    if (!conversationId.trim()) return;

    set({ isLoading: true, error: null });
    try {
      const transcripts = await fetchConversationTranscripts(conversationId);
      set({ transcripts });
    } catch (error) {
      set({ error: getChatToTextErrorMessage(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTranscript: async (id: string) => {
    try {
      await deleteTranscriptApi(id);
      set((state) => ({
        transcripts: state.transcripts.filter((t) => t.id !== id),
      }));
    } catch (error) {
      set({ error: getChatToTextErrorMessage(error) });
    }
  },

  createConversation: async () => {
    set({ isLoading: true, error: null });
    try {
      const conversation = await createSpeechConversation('New Speech Conversation');
      localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, conversation.id);
      set({ conversationId: conversation.id, transcripts: [] });
    } catch (error) {
      set({ error: getChatToTextErrorMessage(error) });
    } finally {
      set({ isLoading: false });
    }
  },
}));

export function hydrateConversationId(): void {
  const stored = localStorage.getItem(CONVERSATION_ID_STORAGE_KEY) ?? '';
  useTranscriptionStore.getState().setConversationId(stored);
}

export { THEME_STORAGE_KEY };
