'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Mic, Square } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranscription } from '@/hooks/useTranscription';
import { SUPPORTED_LANGUAGES, type ITranscript, type Language } from '@/lib/chat-to-text-types';
import { useTranslation } from '@/lib/i18n';
import { hydrateConversationId, useTranscriptionStore } from '@/store/transcription.store';

const card = 'rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';
const outline = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-ink-300 bg-surface px-4 text-sm font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const solid = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-obsidian px-4 text-sm font-bold text-white dark:bg-limeAccent dark:text-obsidian';
const textOf = (transcript: ITranscript) => transcript.normalizedText ?? transcript.rawText ?? '';
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function ChatToTextPage() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const { conversationId, selectedLanguage, transcripts, isLoading, error, setSelectedLanguage, clearError, fetchTranscripts, deleteTranscript, createConversation } = useTranscriptionStore();
  const { startRecording, stopRecording, transcribeUploadedFile } = useTranscription();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  // A conversation is only a container for transcripts, so people never have to see or manage one.
  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    hydrateConversationId();
    if (!useTranscriptionStore.getState().conversationId) void createConversation();
  }, [user, createConversation]);

  useEffect(() => {
    if (user && conversationId) void fetchTranscripts();
  }, [user, conversationId, fetchTranscripts]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const latest = transcripts[0];
  const latestId = latest?.id;
  useEffect(() => {
    setDraft(latest ? textOf(latest) : '');
    setCopied(false);
    // Only a new transcript resets the box, so edits aren't lost on refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  if (!ready) return <div className="min-h-[60vh]" />;

  const languageName = SUPPORTED_LANGUAGES[selectedLanguage as Language] ?? selectedLanguage;

  async function start() {
    clearError();
    setSeconds(0);
    if (await startRecording()) setRecording(true);
  }

  function stop() {
    stopRecording();
    setRecording(false);
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    clearError();
    await transcribeUploadedFile(file);
    event.target.value = '';
  }

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([draft], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'beleqet-transcript.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2.5 px-4 pb-8 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-10 md:pt-8">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">{t('voice.title')}</h1>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-white/75">{t('voice.sub')}</p>
        </div>
      </section>

      {!user ? (
        <div className="mx-auto flex min-h-[40vh] max-w-[560px] flex-col items-center justify-center gap-3 px-4 text-center">
          <h2 className="text-xl font-extrabold text-ink-900 dark:text-white">{t('voice.signInTitle')}</h2>
          <Link href="/login?next=/chat-to-text" className={solid}>{t('postJob.signIn')}</Link>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-start gap-5 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
          <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-4">
            <section className={`${card} flex flex-col items-center gap-3.5 text-center`}>
              <label className="flex items-center gap-2 self-end text-sm font-semibold text-ink-700 dark:text-slate-300">
                {t('voice.language')}
                <select value={selectedLanguage} disabled={recording} onChange={(event) => setSelectedLanguage(event.target.value)} className="min-h-10 rounded-lg border border-ink-300 bg-surface px-2.5 text-sm font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </label>

              {recording ? (
                <>
                  <button type="button" onClick={stop} aria-label={t('voice.stop')} className="grid h-20 w-20 place-items-center rounded-full bg-[#B42318] text-white">
                    <Square className="h-7 w-7" aria-hidden="true" />
                  </button>
                  <b role="status" className="text-ink-900 dark:text-white">{t('voice.recording').replace('{time}', clock(seconds))}</b>
                  <span className="text-sm text-ink-500 dark:text-slate-300">{t('voice.speaking').replace('{language}', languageName)}</span>
                </>
              ) : isLoading ? (
                <>
                  <span className="h-20 w-20 animate-spin rounded-full border-4 border-ink-200 border-t-forest dark:border-slate-700 dark:border-t-limeAccent" aria-hidden="true" />
                  <b role="status" className="text-ink-900 dark:text-white">{t('voice.working')}</b>
                  <span className="text-sm text-ink-500 dark:text-slate-300">{t('voice.workingHint')}</span>
                </>
              ) : (
                <>
                  <button type="button" onClick={start} disabled={!conversationId} aria-label={t('voice.start')} className="grid h-20 w-20 place-items-center rounded-full bg-obsidian text-limeAccent disabled:opacity-60">
                    <Mic className="h-8 w-8" aria-hidden="true" />
                  </button>
                  <b className="text-ink-900 dark:text-white">{t('voice.tapStart')}</b>
                  <span className="text-sm text-ink-500 dark:text-slate-300">{t('voice.micAsk')}</span>
                </>
              )}

              {!recording && !isLoading && (
                <span className="text-sm text-ink-500 dark:text-slate-300">
                  {t('voice.or')}{' '}
                  <button type="button" onClick={() => fileInput.current?.click()} className="font-bold text-forest hover:underline dark:text-limeAccent">{t('voice.upload')}</button>{' '}
                  {t('voice.upTo')}
                </span>
              )}
              <input ref={fileInput} type="file" accept="audio/*" aria-label={t('voice.upload')} onChange={upload} className="sr-only" />
              {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
            </section>

            {latest && (
              <section className={`${card} flex flex-col gap-3`}>
                <b className="text-ink-900 dark:text-white">{t('voice.yourText').replace('{language}', SUPPORTED_LANGUAGES[latest.language as Language] ?? latest.language)}</b>
                {latest.status === 'FAILED' && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{t('voice.failed')}</p>}
                <textarea rows={6} aria-label={t('voice.transcript')} value={draft} onChange={(event) => setDraft(event.target.value)} className="resize-y rounded-lg border border-ink-300 bg-surface p-3 text-base leading-normal text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('voice.check')}</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => copy(draft)} className={solid}>{t(copied ? 'voice.copied' : 'voice.copy')}</button>
                  <button type="button" onClick={download} className={outline}>{t('voice.download')}</button>
                </div>
              </section>
            )}
          </div>

          <aside aria-labelledby="hist-h" className={`${card} flex w-full min-w-0 flex-[1_1_280px] flex-col gap-3 md:max-w-[360px]`}>
            <h2 id="hist-h" className="text-base font-bold text-ink-900 dark:text-white">{t('voice.recent')}</h2>
            {transcripts.length === 0 && <span className="text-sm text-ink-500 dark:text-slate-300">{t('voice.none')}</span>}
            {transcripts.map((transcript) => (
              <article key={transcript.id} className="flex flex-col gap-1 border-t border-[#F1F4F6] pt-2.5 dark:border-slate-800">
                <span className="text-xs text-ink-500 dark:text-slate-400">
                  {new Date(transcript.createdAt).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short' })} · {SUPPORTED_LANGUAGES[transcript.language as Language] ?? transcript.language}
                </span>
                <p className="line-clamp-2 text-sm text-ink-700 dark:text-slate-300">{textOf(transcript)}</p>
                <span className="flex gap-3 text-[13px] font-bold">
                  <button type="button" onClick={() => copy(textOf(transcript))} className="min-h-9 text-forest dark:text-limeAccent">{t('voice.copy')}</button>
                  <button type="button" onClick={() => void deleteTranscript(transcript.id)} className="min-h-9 text-ink-500 dark:text-slate-300">{t('voice.delete')}</button>
                </span>
              </article>
            ))}
            <span className="text-xs leading-normal text-ink-500 dark:text-slate-400">{t('voice.privacy')}</span>
          </aside>
        </div>
      )}
    </>
  );
}
