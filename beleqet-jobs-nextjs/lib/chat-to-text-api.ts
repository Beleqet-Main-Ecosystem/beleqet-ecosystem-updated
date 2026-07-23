import axios, { AxiosError, AxiosInstance } from 'axios';
import type { ISpeechConversation, ITranscript } from './chat-to-text-types';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:4001';

function normalizeApiBaseUrl(rawUrl?: string): string {
  const value = rawUrl?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  const withoutTrailingSlash = value.replace(/\/+$/, '');
  if (/\/api\/v1$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/\/api\/v1$/i, '');
  }
  if (/\/api$/i.test(withoutTrailingSlash)) {
    return withoutTrailingSlash.replace(/\/api$/i, '');
  }

  return withoutTrailingSlash;
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

export const chatToTextApi: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Adds the current user's JWT at request time, after browser storage is available. */
chatToTextApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('beleqet_token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return config;
});

interface IApiSuccessResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  count?: number;
}

interface IApiErrorResponse {
  message?: string | string[];
}

export function getChatToTextErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response?.data) {
    const payload = error.response.data as IApiErrorResponse;
    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }
    if (typeof payload.message === 'string') {
      return payload.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export async function createSpeechConversation(
  title?: string,
): Promise<ISpeechConversation> {
  const { data } = await chatToTextApi.post<IApiSuccessResponse<ISpeechConversation>>(
    '/chat-to-text/conversations',
    { title },
  );
  return data.data;
}

export async function fetchConversationTranscripts(
  conversationId: string,
): Promise<ITranscript[]> {
  const { data } = await chatToTextApi.get<IApiSuccessResponse<ITranscript[]>>(
    `/chat-to-text/conversation/${conversationId.trim()}`,
  );
  return data.data ?? [];
}

export async function deleteTranscript(id: string): Promise<void> {
  await chatToTextApi.delete(`/chat-to-text/${id}`);
}

export async function transcribeAudio(
  conversationId: string,
  language: string,
  audioBlob: Blob,
): Promise<ITranscript> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('conversationId', conversationId);
  formData.append('language', language);

  const { data } = await chatToTextApi.post<IApiSuccessResponse<ITranscript>>(
    '/chat-to-text/transcribe',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function transcribeStreamChunk(
  conversationId: string,
  language: string,
  audioBlob: Blob,
  isFinal = false,
): Promise<ITranscript> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'stream-chunk.webm');
  formData.append('conversationId', conversationId);
  formData.append('language', language);
  formData.append('isFinal', String(isFinal));

  const { data } = await chatToTextApi.post<IApiSuccessResponse<ITranscript>>(
    '/chat-to-text/stream',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}
