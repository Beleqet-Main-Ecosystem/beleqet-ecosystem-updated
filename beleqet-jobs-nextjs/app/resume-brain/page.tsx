"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { CvUpload } from "@/components/resume-brain/CvUpload";
import { ParsedResumePreview } from "@/components/resume-brain/ParsedResumePreview";
import { UploadResumeResponse } from "@/components/resume-brain/types";

export default function ResumeBrainPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [uploaded, setUploaded] = useState<UploadResumeResponse | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="container-page py-24 text-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-primary/10 bg-primary text-white">
        <div className="container-page py-12">
          <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            <Sparkles className="h-4 w-4" /> Resume Brain
          </p>
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-black leading-none tracking-[-.05em]">
            Upload your CV. We&apos;ll do the typing.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
            Upload a PDF or Word CV and Resume Brain extracts your education, work
            experience, and skills automatically — review and confirm before it
            fills in your profile.
          </p>
        </div>
      </section>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-2">
        <CvUpload onUploaded={setUploaded} />
        {uploaded && (
          <ParsedResumePreview
            resume={uploaded.parsedResume}
            resumeId={uploaded.parsedResume.id}
            userId={user.id}
          />
        )}
      </div>
    </div>
  );
}
