'use client';

import { ChangeEvent, DragEvent, useCallback, useRef, useState } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadResume, messageFromResumeBrainError } from './api';
import { useResumeBrainI18n } from './i18n';
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
}

/**
 * Drag-and-drop (and click-to-browse) CV uploader with GDPR consent gating,
 * client-side type/size validation, upload progress, and error states.
 */
export function CvUpload({ onUploaded, maxSizeMb = DEFAULT_MAX_SIZE_MB }: CvUploadProps) {
  const { t } = useResumeBrainI18n();
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
    <section className="rounded-[24px] border border-primary/10 bg-white p-5 sm:p-6">
      <div className="mb-5 flex gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-extrabold text-primary">{t('uploadTitle')}</h2>
          <p className="mt-0.5 text-xs text-muted">{t('uploadSubtitle', { maxSizeMb })}</p>
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
          'flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-7 text-center text-sm font-bold text-primary transition',
          isDragging ? 'border-brandGreen bg-brandGreen/5' : 'border-primary/15 bg-[#f7f5ef]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <FileText className="h-6 w-6 text-brandGreen" />
        {file ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
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
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-2 text-xs font-bold text-primary hover:border-brandGreen hover:text-brandGreen"
        >
          {t('browseButton')}
        </button>
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-ink">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-primary/30 text-brandGreen focus:ring-brandGreen/40"
        />
        <span>{t('consentLabel')}</span>
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent">
          {error}
        </p>
      )}

      {phase === 'success' && (
        <p className="mt-3 rounded-xl bg-brandGreen/10 px-4 py-3 text-sm font-semibold text-brandGreen">
          {t('uploadSuccess')}
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || isBusy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brandGreen disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {phase === 'uploading' && `${t('uploading')} ${progress}%`}
        {phase === 'parsing' && t('parsing')}
        {(phase === 'idle' || phase === 'success' || phase === 'error') && t('uploadButton')}
      </button>
    </section>
  );
}
