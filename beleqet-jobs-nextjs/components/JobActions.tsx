"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, FileUp, Send, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function JobActions({ jobId }: { jobId: string }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    authenticatedFetch(`${API_URL}/users/saved-jobs`).then(async (response) => {
      if (response.ok)
        setSaved(
          (await response.json()).some(
            (item: { jobId: string }) => item.jobId === jobId,
          ),
        );
    });
  }, [jobId, user]);

  async function toggleSaved() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
      return;
    }
    const response = await authenticatedFetch(
      `${API_URL}/users/saved-jobs/${jobId}`,
      { method: saved ? "DELETE" : "POST" },
    );
    if (response.ok) setSaved(!saved);
  }

  function startApplication() {
    if (!ready) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
      return;
    }
    setError("");
    setOpen(true);
  }

  async function uploadResume(file: File): Promise<string> {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type))
      throw new Error("Resume must be a PDF, DOC, or DOCX file.");
    if (file.size > 5 * 1024 * 1024)
      throw new Error("Resume must be smaller than 5 MB.");

    const formData = new FormData();
    formData.append("file", file);

    const response = await authenticatedFetch(
      `${API_URL}/uploads/file`,
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Resume upload failed. Please try again.");
    return data.publicUrl;
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplying(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const file = form.get("resume");
      const resumeUrl =
        file instanceof File && file.size
          ? await uploadResume(file)
          : undefined;
      const salary = form.get("expectedSalary")?.toString();
      const response = await authenticatedFetch(`${API_URL}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          coverLetter: form.get("coverLetter"),
          resumeUrl,
          portfolioUrl: form.get("portfolioUrl") || undefined,
          expectedSalary: salary ? Number(salary) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Application could not be submitted.",
        );
      setApplied(true);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Application could not be submitted.",
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-white p-6">
        <button
          onClick={startApplication}
          disabled={applied || !ready}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brandGreen py-3 text-sm font-semibold text-white transition-colors hover:bg-darkGreen disabled:opacity-60"
        >
          {applied ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {applied ? "Application submitted" : "Apply now"}
        </button>
        <button
          onClick={toggleSaved}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-ink transition-colors hover:bg-pageBg"
        >
          <Bookmark
            className={`h-4 w-4 ${saved ? "fill-brandGreen text-brandGreen" : ""}`}
          />
          {saved ? "Saved" : "Save job"}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-primary/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="application-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-[#f7f5ef] shadow-2xl sm:rounded-[28px]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-brandGreen">
                  Job application
                </p>
                <h2
                  id="application-title"
                  className="mt-1 text-xl font-black text-primary"
                >
                  Tell the employer about yourself
                </h2>
              </div>
              <button
                onClick={() => !applying && setOpen(false)}
                aria-label="Close application form"
                className="rounded-full p-2 text-muted hover:bg-pageBg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitApplication} className="space-y-5 p-6">
              <label className="block text-xs font-bold text-ink">
                Cover letter
                <textarea
                  name="coverLetter"
                  required
                  minLength={50}
                  maxLength={10000}
                  rows={8}
                  placeholder="Explain why your experience and skills fit this role…"
                  className="mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-brandGreen"
                />
                <span className="mt-1 block font-normal text-muted">
                  Minimum 50 characters. Be specific to this role.
                </span>
              </label>
              <label className="block text-xs font-bold text-ink">
                Resume or CV
                <span className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/15 bg-white p-5 text-sm font-semibold text-muted hover:border-brandGreen">
                  <FileUp className="h-5 w-5 text-brandGreen" />
                  <input
                    name="resume"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="min-w-0 text-xs"
                  />
                </span>
                <span className="mt-1 block font-normal text-muted">
                  PDF, DOC, or DOCX; maximum 5 MB.
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-ink">
                  Portfolio URL
                  <input
                    name="portfolioUrl"
                    type="url"
                    placeholder="https://…"
                    className="mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-brandGreen"
                  />
                </label>
                <label className="block text-xs font-bold text-ink">
                  Expected salary (ETB)
                  <input
                    name="expectedSalary"
                    type="number"
                    min="0"
                    placeholder="Optional"
                    className="mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-brandGreen"
                  />
                </label>
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-redAccent/10 px-4 py-3 text-sm font-semibold text-redAccent"
                >
                  {error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={applying}
                  className="rounded-full border border-primary/15 px-5 py-3 text-sm font-bold text-primary"
                >
                  Cancel
                </button>
                <button
                  disabled={applying}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-brandGreen disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {applying
                    ? "Uploading and submitting…"
                    : "Submit application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
