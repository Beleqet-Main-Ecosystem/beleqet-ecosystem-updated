'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { CvUpload } from '@/components/resume-brain/CvUpload';
import { ParsedResumePreview } from '@/components/resume-brain/ParsedResumePreview';
import { ResumeBrainLocale, translate } from '@/components/resume-brain/i18n';
import { UploadResumeResponse } from '@/components/resume-brain/types';

export default function ResumeBrainPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [uploaded, setUploaded] = useState<UploadResumeResponse | null>(null);
  const [locale, setLocale] = useState<ResumeBrainLocale>('en');

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="container-page py-24 text-center text-muted">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-primary/10 bg-primary text-white">
        <div className="container-page py-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              <Sparkles className="h-4 w-4" /> Resume Brain
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white">
              <button
                type="button"
                className={locale === 'en' ? 'text-white' : 'text-white/70'}
                onClick={() => setLocale('en')}
              >
                EN
              </button>
              <span className="text-white/40">|</span>
              <button
                type="button"
                className={locale === 'am' ? 'text-white' : 'text-white/70'}
                onClick={() => setLocale('am')}
              >
                አማ
              </button>
            </div>
          </div>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-none tracking-[-.05em]">
            {translate(locale, 'pageTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
            {translate(locale, 'pageSubtitle')}
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <CvUpload onUploaded={setUploaded} locale={locale} />
        {uploaded && (
          <ParsedResumePreview
            resume={uploaded.parsedResume}
            resumeId={uploaded.parsedResume.id}
            userId={user.id}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
