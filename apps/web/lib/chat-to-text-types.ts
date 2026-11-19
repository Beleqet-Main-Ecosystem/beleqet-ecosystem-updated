export enum TranscriptStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ITranscript {
  id: string;
  conversationId: string;
  audioUrl: string | null;
  videoUrl: string | null;
  duration: number | null;
  rawText: string | null;
  normalizedText: string | null;
  language: string;
  confidence: number | null;
  provider: string | null;
  processingTime: number | null;
  status: TranscriptStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ISpeechConversation {
  id: string;
  userId: string | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Language = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'am';

export const SUPPORTED_LANGUAGES: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  zh: '中文',
  ja: '日本語',
  am: 'አማርኛ',
};
