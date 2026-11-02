'use client';

import { ChangeEvent, DragEvent, useCallback, useRef, useState } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadResume, messageFromResumeBrainError } from './api';
import { ResumeBrainLocale, useResumeBrainI18n } from './i18n';
import { UploadResumeResponse } from './types';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx';
const DEFAULT_MAX_SIZE_MB = 10;

type UploadPhase = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

export interface CvUploadProps {
  /** Called once the CV has been uploaded and parsed successfully. */
  onUploaded: (result: UploadResumeResponse) => void;
  /** Maximum accepted file size in MB, must match the backend's configured limit. */
  maxSizeMb?: number;
  /** Locale used by the Resume Brain UI strings. */
  locale?: ResumeBrainLocale;
}

/**
 * Drag-and-drop (and click-to-browse) CV uploader with GDPR consent gating,
 * client-side type/size validation, upload progress, and error states.
 */
export function CvUpload({
  onUploaded,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  locale = 'en',
}: CvUploadProps) {
  const { t } = useResumeBrainI18n(locale);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      setError(null);

      if (!ACCEPTED_MIME_TYPES.includes(candidate.type)) {
        setError(t('errorFileType'));
        return;
      }
      if (candidate.size > maxSizeMb * 1024 * 1024) {
        setError(t('errorFileSize', { maxSizeMb }));
        return;
      }
      setFile(candidate);
      setPhase('idle');
    },
    [maxSizeMb, t],
  );

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    validateAndSetFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    validateAndSetFile(event.dataTransfer.files?.[0]);
  }

  async function handleUpload() {
    if (!file) return;
    if (!consent) {
      setError(t('consentRequiredError'));
      return;
    }

    setError(null);
    setPhase('uploading');
    setProgress(0);

    try {
      const result = await uploadResume(file, consent, (percent) => {
        setProgress(percent);
        if (percent >= 100) setPhase('parsing');
      });
      setPhase('success');
      onUploaded(result);
    } catch (err) {
      setPhase('error');
      setError(messageFromResumeBrainError(err, t('errorGeneric')));
    }
  }

  const isBusy = phase === 'uploading' || phase === 'parsing';

  return (
    <section className="rounded-xl border border-ink-200 dark:border-slate-800 bg-surface dark:bg-slate-900 p-5 sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-limeAccent text-ink-900 dark:text-white-900 dark:text-white">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-extrabold text-ink-900 dark:text-white-900 dark:text-white">{t('uploadTitle')}</h2>
          <p className="mt-0.5 text-xs text-ink-900 dark:text-white-500 dark:text-slate-300">{t('uploadSubtitle', { maxSizeMb })}</p>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-7 text-center text-sm font-bold text-ink-900 dark:text-white-900 dark:text-white transition',
          isDragging ? 'border-brandGreen bg-obsidian dark:bg-limeAccent dark:text-obsidian/5' : 'border-ink-200 dark:border-slate-800 bg-canvas dark:bg-slate-950',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <FileText className="h-6 w-6 text-forest dark:text-limeAccent" />
        {file ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-900 dark:text-white">
            <span>
              {t('selectedFile')}: {file.name}
            </span>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label={t('removeFile')}
              className="text-redAccent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p>{t('dropzoneText')}</p>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200 dark:border-slate-800 px-4 py-2 text-xs font-bold text-ink-900 dark:text-white-900 dark:text-white hover:border-brandGreen hover:text-forest dark:text-limeAccent"
        >
          {t('browseButton')}
        </button>
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-ink-900 dark:text-white">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-200 dark:border-slate-800 text-forest dark:text-limeAccent focus:ring-brandGreen/40"
        />
        <span>{t('consentLabel')}</span>
      </label>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent"
        >
          {error}
        </p>
      )}

      {phase === 'success' && (
        <p className="mt-3 rounded-xl bg-obsidian dark:bg-limeAccent dark:text-obsidian/10 px-4 py-3 text-sm font-semibold text-forest dark:text-limeAccent">
          {t('uploadSuccess')}
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || isBusy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-obsidian px-4 py-2.5 text-xs font-bold text-white transition hover:bg-obsidian dark:bg-limeAccent dark:text-obsidian disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {phase === 'uploading' && `${t('uploading')} ${progress}%`}
        {phase === 'parsing' && t('parsing')}
        {(phase === 'idle' || phase === 'success' || phase === 'error') && t('uploadButton')}
      </button>
    </section>
  );
}
