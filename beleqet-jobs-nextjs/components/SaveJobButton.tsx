"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function SaveJobButton({
  jobId,
  light = true,
}: {
  jobId: string;
  light?: boolean;
}) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }

    authenticatedFetch(`${API_URL}/users/saved-jobs`).then(async (response) => {
      if (!response.ok) return;
      const jobs = (await response.json()) as Array<{ jobId: string }>;
      setSaved(jobs.some((item) => item.jobId === jobId));
    });
  }, [jobId, user]);

  async function toggleSaved() {
    if (!ready || loading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
      return;
    }

    setLoading(true);
    const response = await authenticatedFetch(
      `${API_URL}/users/saved-jobs/${jobId}`,
      { method: saved ? "DELETE" : "POST" },
    );
    if (response.ok) setSaved((current) => !current);
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      disabled={!ready || loading}
      aria-label={saved ? "Remove from saved jobs" : "Save job"}
      title={saved ? "Remove from saved jobs" : "Save job"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-wait disabled:opacity-60 ${
        light
          ? "bg-pageBg text-muted hover:bg-brandGreen/10 hover:text-brandGreen"
          : "bg-white/10 text-white/60 hover:text-[#d8ff3e]"
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bookmark
          className={`h-4 w-4 ${saved ? "fill-brandGreen text-brandGreen" : ""}`}
        />
      )}
    </button>
  );
}
