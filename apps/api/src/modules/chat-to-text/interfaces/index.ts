export interface IUploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ITranscriptionResult {
  text: string;
}

export interface IConversationHistory {
  id: string;
  userId: string | null;
  title: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  transcripts: ITranscriptSummary[];
  messages: IMessageSummary[];
  user: IUserSummary | null;
}

export interface ITranscriptSummary {
  id: string;
  conversationId: string;
  rawText: string | null;
  normalizedText: string | null;
  language: string;
  status: string;
  duration: number | null;
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageSummary {
  id: string;
  conversationId: string;
  transcriptId: string | null;
  content: string;
  type: string;
  sender: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserSummary {
  id: string;
  email: string;
  name: string | null;
}

export interface IConversationStatistics {
  totalTranscripts: number;
  completedTranscripts: number;
  failedTranscripts: number;
  pendingTranscripts: number;
  processingTranscripts: number;
  totalDuration: number;
  languages: string[];
}
