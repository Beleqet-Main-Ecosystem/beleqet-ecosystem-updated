'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  Clock3,
  Headphones,
  Languages,
  MessageSquare,
  Mic,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  useTranscriptionStore,
  hydrateConversationId,
} from '@/store/transcription.store';
import { useTranscription } from '@/hooks/useTranscription';
import { SUPPORTED_LANGUAGES, type Language } from '@/lib/chat-to-text-types';

export default function ChatToTextPage() {
  const {
    conversationId,
    selectedLanguage,
    transcripts,
    isLoading,
    error,
    setConversationId,
    setSelectedLanguage,
    clearError,
    fetchTranscripts,
    deleteTranscript,
    createConversation,
  } = useTranscriptionStore();

  const { startRecording, stopRecording, transcribeUploadedFile } = useTranscription();
  const [isRecording, setIsRecording] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    hydrateConversationId();
  }, []);

  useEffect(() => {
    if (conversationId.trim()) {
      void fetchTranscripts();
    }
  }, [conversationId, fetchTranscripts]);

  const handleStartRecording = useCallback(async () => {
    const started = await startRecording();
    if (started) {
      setIsRecording(true);
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    setIsRecording(false);
  }, [stopRecording]);

  const handleUploadAudio = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const succeeded = await transcribeUploadedFile(file);
      if (succeeded) {
        event.target.value = '';
      }
    },
    [transcribeUploadedFile],
  );

  const handleDeleteTranscript = useCallback(
    async (id: string) => {
      if (deletingIds.has(id)) return;
      setDeletingIds((prev) => new Set(prev).add(id));
      try {
        await deleteTranscript(id);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [deleteTranscript, deletingIds],
  );

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_26%),linear-gradient(180deg,_#f8fbf8_0%,_#f3f7f3_100%)] text-slate-900">
      <section className="relative overflow-hidden bg-[#0a1f0a] px-6 py-20 text-white lg:px-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(74,222,128,0.16),_transparent_30%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-400/30 bg-[#1a3a1a] px-3 py-1 text-sm font-semibold text-green-300">
              <Sparkles size={16} />
              FREE SPEECH-TO-TEXT
            </div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              Turn every conversation into clear, searchable text.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-gray-300">
              Record your voice, capture a transcript, and keep every note organized without changing the workflow underneath.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-gray-200">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <CheckCircle2 size={16} className="text-green-300" /> Instant transcription
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2">
                <Headphones size={16} className="text-green-300" /> Multi-language support
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-400 p-3 text-black">
                <Mic size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-300">Ready when you are</p>
                <p className="text-sm text-gray-300">
                  {transcripts.length} saved transcript{transcripts.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
        <div className="flex flex-col gap-6">
          {error && (
            <div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
              <div className="flex items-start gap-2">
                <CircleAlert size={18} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={clearError}
                className="ml-4 font-bold text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(0,0,0,0.08)]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Record Audio</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Start a new session and transcribe your speech in real time.
                </p>
              </div>
              <div className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {transcripts.length} transcript{transcripts.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label
                htmlFor="conversation-id"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Conversation ID
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="conversation-id"
                  type="text"
                  value={conversationId}
                  onChange={(event) => setConversationId(event.target.value)}
                  disabled={isRecording || isLoading}
                  className="w-full flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  placeholder="Paste an existing conversation ID"
                  aria-describedby="conversation-id-help"
                />
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  disabled={isRecording || isLoading}
                  className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  New Conversation
                </button>
              </div>
              <p id="conversation-id-help" className="mt-2 text-sm text-slate-500">
                Create a new conversation or use the seeded demo ID after running prisma seed.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label
                htmlFor="language-select"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Language
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900">
                <Languages size={16} className="text-slate-500" />
                <select
                  id="language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={isRecording}
                  className="w-full bg-transparent outline-none"
                >
                  {(Object.entries(SUPPORTED_LANGUAGES) as [Language, string][]).map(
                    ([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!isRecording ? (
                <button
                  id="btn-start-recording"
                  onClick={handleStartRecording}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a1f0a] px-8 py-3 text-lg font-semibold text-white transition hover:bg-[#17361a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Mic size={18} /> Start Recording
                </button>
              ) : (
                <button
                  id="btn-stop-recording"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-red-700 active:bg-red-800"
                >
                  <Mic size={18} /> ⏹ Stop Recording
                </button>
              )}

              {isRecording && (
                <div className="flex items-center gap-2 font-semibold text-red-600">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
                  Recording...
                </div>
              )}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-900 hover:text-slate-900">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadAudio}
                  className="sr-only"
                />
                <Upload size={18} /> Upload Audio
              </label>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-green-700">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                Processing audio...
              </div>
            )}

            <p className="mt-4 text-sm text-slate-500">
              Speak clearly and keep the clip going for a moment. Very short or silent audio will be rejected automatically.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="sticky top-4 h-fit rounded-[32px] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(0,0,0,0.08)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2 text-green-700">
                <AudioLines size={20} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Live transcription feed</h2>
                <p className="text-sm text-slate-500">Recent transcripts stay here for quick review.</p>
              </div>
            </div>

            <div className="rounded-[24px] bg-[#f4f8f4] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  Active session
                </span>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Clock3 size={14} /> {conversationId || 'No conversation selected'}
                </span>
              </div>
              <div className="rounded-xl border border-green-100 bg-white p-4 text-sm leading-6 text-slate-600">
                {transcripts.length > 0 ? transcripts[0].normalizedText ?? transcripts[0].rawText : 'Start recording to capture your first transcript.'}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(0,0,0,0.08)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Recent transcripts</h3>
                <p className="text-sm text-slate-500">Everything is kept in one place for easy copying and cleanup.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                {transcripts.length}
              </div>
            </div>

            {transcripts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
                No transcripts yet. Start recording to create one.
              </div>
            ) : (
              <div className="space-y-4">
                {transcripts.map((transcript) => (
                  <div key={transcript.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm transition hover:shadow-md">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                            {transcript.status}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(transcript.createdAt).toLocaleString()}
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            [{transcript.language.toUpperCase()}]
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(transcript.normalizedText ?? '')}
                          className="rounded-lg p-2 transition-colors hover:bg-slate-200"
                          title="Copy to clipboard"
                          aria-label="Copy transcript to clipboard"
                        >
                          <Clipboard size={16} className="text-slate-600" />
                        </button>
                        <button
                          onClick={() => void handleDeleteTranscript(transcript.id)}
                          disabled={deletingIds.has(transcript.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Delete transcript"
                          aria-label="Delete transcript"
                        >
                          {deletingIds.has(transcript.id) ? '⏳' : <Trash2 size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-slate-700">
                      <div>
                        <p className="mb-1 font-semibold text-slate-900">Raw text</p>
                        <p className="rounded-xl bg-white p-3 text-slate-600">
                          {transcript.rawText ?? 'No raw text available.'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-slate-900">Normalized text</p>
                        <p className="rounded-xl bg-white p-3 text-slate-600">
                          {transcript.normalizedText ?? 'No normalized text available.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <button className="fixed bottom-6 right-6 rounded-full bg-green-700 p-4 text-white shadow-[0_12px_35px_rgba(22,101,52,0.3)] transition hover:bg-green-800">
        <MessageSquare size={24} />
      </button>
    </div>
  );
}
