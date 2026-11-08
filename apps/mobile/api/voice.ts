/** Chat-to-Text: speech to text. Same endpoints as the website (lib/chat-to-text-api.ts). */
import * as SecureStore from 'expo-secure-store';
import { get, send, upload, type PickedFile } from '../lib/api';

export type Transcript = {
  id: string;
  conversationId: string;
  rawText: string | null;
  normalizedText: string | null;
  language: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  createdAt: string;
};

/** The languages the website offers, with their own names. */
export const LANGUAGES: Record<string, string> = {
  am: 'አማርኛ',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
};

type Wrapped<T> = { success: boolean; data: T };
const CONVERSATION_KEY = 'beleqet_voice_conversation';

/** The person's voice conversation, created on first use and remembered on this phone. */
export async function conversationId(): Promise<string> {
  const saved = await SecureStore.getItemAsync(CONVERSATION_KEY).catch(() => null);
  if (saved) return saved;
  const created = await send<Wrapped<{ id: string }>>('POST', '/chat-to-text/conversations', { title: 'Mobile' });
  await SecureStore.setItemAsync(CONVERSATION_KEY, created.data.id).catch(() => undefined);
  return created.data.id;
}

export async function fetchTranscripts(id: string): Promise<Transcript[]> {
  const result = await get<Wrapped<Transcript[]>>(`/chat-to-text/conversation/${encodeURIComponent(id)}`);
  return result.data ?? [];
}

export async function transcribe(id: string, language: string, audio: PickedFile): Promise<Transcript> {
  const result = await upload<Wrapped<Transcript>>('/chat-to-text/transcribe', audio, { conversationId: id, language });
  return result.data;
}

export const deleteTranscript = (id: string) => send('DELETE', `/chat-to-text/${encodeURIComponent(id)}`);

/** Forget the saved conversation (e.g. it was deleted on the server). */
export const forgetConversation = () => SecureStore.deleteItemAsync(CONVERSATION_KEY).catch(() => undefined);
