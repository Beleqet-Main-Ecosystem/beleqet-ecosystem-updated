'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { CvUpload } from '@/components/resume-brain/CvUpload';
import { ParsedResumePreview } from '@/components/resume-brain/ParsedResumePreview';
import { translate } from '@/components/resume-brain/i18n';
import { UploadResumeResponse } from '@/components/resume-brain/types';
import { useTranslation } from '@/lib/i18n';

const STEPS = ['upload', 'review', 'done'] as const;

export default function ResumeBrainPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [uploaded, setUploaded] = useState<UploadResumeResponse | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent('/resume-brain')}`);
  }, [ready, user, router]);

  if (!ready || !user) return <div className="min-h-[60vh]" />;

  const step = uploaded ? 1 : 0;

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2.5 px-4 pb-8 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-10 md:pt-8">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">Resume Brain</h1>
          <p className="max-w-[640px] text-[15px] leading-relaxed text-white/75">{translate(locale, 'pageSubtitle')}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
        <ol aria-label={t('freelance.post2.progress')} className="grid grid-cols-3 gap-2.5">
          {STEPS.map((name, index) => (
            <li key={name} aria-current={index === step ? 'step' : undefined} className="flex flex-col gap-2">
              <span className={`h-1 rounded-full ${index <= step ? 'bg-obsidian dark:bg-limeAccent' : 'bg-ink-200 dark:bg-slate-800'}`} />
              <span className={`text-[13px] font-bold ${index <= step ? 'text-ink-900 dark:text-white' : 'text-ink-500 dark:text-slate-400'}`}>
                {index + 1}. {t(`resumeBrain.steps.${name}`)}
              </span>
            </li>
          ))}
        </ol>
        <div className="grid gap-5 lg:grid-cols-2">
          <CvUpload onUploaded={setUploaded} locale={locale} />
          {uploaded && (
            <ParsedResumePreview resume={uploaded.parsedResume} resumeId={uploaded.parsedResume.id} userId={user.id} locale={locale} />
          )}
        </div>
      </div>
    </>
  );
}
