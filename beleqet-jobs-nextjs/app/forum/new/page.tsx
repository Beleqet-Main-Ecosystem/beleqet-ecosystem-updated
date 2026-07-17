"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Send,
  Eye,
  EyeOff,
  Hash,
  Lightbulb,
  MessageSquare,
  Edit3,
  Heart,
  X,
  AlertCircle,
  Info,
  Users,
} from "lucide-react";
import { createThread } from "@/lib/forum-api";

const TIPS = [
  { icon: Heart, text: "Be respectful and constructive in your tone" },
  { icon: Lightbulb, text: "Clear titles get better responses" },
  { icon: MessageSquare, text: "Share context: what you tried, what you expect" },
];

function ProgressBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min((current / max) * 100, 100);
  const color =
    pct > 90 ? "bg-redAccent" : pct > 75 ? "bg-amber-500" : "bg-brandGreen";
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-muted">
        {current}/{max}
      </span>
    </div>
  );
}

export default function NewThreadPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const wordCount = useMemo(
    () => content.trim().split(/\s+/).filter(Boolean).length,
    [content],
  );

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleTagKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setError("You must be logged in.");
      return;
    }

    setSubmitting(true);
    try {
      const thread = await createThread(
        {
          title: title.trim(),
          content: content.trim(),
          tags,
          isAnonymous,
        },
        token,
      );
      router.push(`/forum/${thread.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create thread.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Top bar */}
      <div className="border-b border-primary/5 bg-white/80 backdrop-blur-md">
        <div className="container-page flex items-center justify-between py-3">
          <Link
            href="/forum"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brandGreen"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back to Forum
          </Link>
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-muted sm:inline-flex">
            <Sparkles className="h-3 w-3 text-brandGreen" />
            Community Forum
          </span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-brandGreen">
        <div className="absolute inset-0 opacity-[0.06] hero-grid" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#d8ff3e]/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brandGreen/20 blur-3xl" />

        <div className="container-page relative py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e]/15 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
                <Sparkles className="h-3 w-3" />
                New Thread
              </div>
              <h1 className="text-pageH1 mt-4 text-white">
                Start a Discussion
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
                Share your thoughts, ask questions, or start a conversation with the community
              </p>
            </div>

            <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 backdrop-blur-sm">
              <Info className="h-5 w-5 text-[#d8ff3e]/60" />
              <div className="text-xs text-white/50">
                <p className="font-semibold text-white/70">Community Guidelines</p>
                <p>Be kind, be clear, be helpful</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <div className="container-page mt-8 pb-16">
        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg shadow-red-500/5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid gap-7 lg:grid-cols-[1fr_320px] lg:gap-12">
            {/* Main column */}
            <div className="space-y-7">
              {/* Title card */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border border-border bg-white shadow-card transition-all duration-300 hover:shadow-cardHover overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-primary/5 bg-gradient-to-r from-primary/[0.02] to-transparent px-5 py-3.5 sm:px-6">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brandGreen to-darkGreen text-white shadow-sm">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-primary">Title</span>
                  {title.trim() && (
                    <span className="ml-auto text-[11px] font-medium text-muted">
                      {title.trim().split(/\s+/).length} words
                    </span>
                  )}
                </div>
                <div className="p-5 sm:p-6 pt-4 sm:pt-5">
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl border border-border bg-pageBg/50 px-4 py-3 text-base font-medium text-primary placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-brandGreen/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,101,59,0.08)]"
                    placeholder="e.g. How do I get started with NestJS?"
                    autoFocus
                  />
                  <ProgressBar current={title.length} max={200} />
                </div>
              </div>

              {/* Content card */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border border-border bg-white shadow-card transition-all duration-300 hover:shadow-cardHover overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-primary/5 bg-gradient-to-r from-brandGreen/[0.03] to-transparent px-5 py-3.5 sm:px-6">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyanAccent to-blue-600 text-white shadow-sm">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-primary">Content</span>
                  {content.trim() && (
                    <span className="ml-auto text-[11px] font-medium text-muted">
                      ~{wordCount} {wordCount === 1 ? "word" : "words"}
                    </span>
                  )}
                </div>
                <div className="p-5 sm:p-6 pt-4 sm:pt-5">
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    maxLength={10000}
                    rows={10}
                    className="w-full min-h-[200px] resize-y rounded-xl border border-border bg-pageBg/50 px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-muted/40 outline-none transition-all duration-200 focus:border-brandGreen/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,101,59,0.08)]"
                    placeholder="Share your thoughts, questions, or advice..."
                  />
                  <ProgressBar current={content.length} max={10000} />
                </div>
              </div>

              {/* Tags card */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border border-border bg-white shadow-card transition-all duration-300 hover:shadow-cardHover overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-primary/5 bg-gradient-to-r from-purple-500/[0.04] to-transparent px-5 py-3.5 sm:px-6">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purpleAccent to-purple-700 text-white shadow-sm">
                    <Hash className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-primary">
                    Tags <span className="font-normal text-muted">({tags.length}/10)</span>
                  </span>
                </div>
                <div className="p-5 sm:p-6 pt-4 sm:pt-5">
                  {tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100/50 px-2.5 py-1 text-[11px] font-semibold text-purple-700"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-700 transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-pageBg/50 px-3 transition-all duration-200 focus-within:border-purple-400/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.08)]">
                    <Hash className="h-4 w-4 shrink-0 text-muted/40" />
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKey}
                      onBlur={() => tagInput && addTag(tagInput)}
                      maxLength={30}
                      disabled={tags.length >= 10}
                      className="flex-1 bg-transparent px-1 py-2.5 text-sm text-ink placeholder:text-muted/40 outline-none disabled:opacity-40"
                      placeholder={tags.length >= 10 ? "Max 10 tags reached" : "Type and press Enter"}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">
                    Keywords help others find your thread
                  </p>
                </div>
              </div>

              {/* Anonymous card */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border border-border bg-white shadow-card transition-all duration-300 hover:shadow-cardHover overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-primary/5 bg-gradient-to-r from-amber-500/[0.05] to-transparent px-5 py-3.5 sm:px-6">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                    {isAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-bold text-primary">Visibility</span>
                </div>
                <div className="p-5 sm:p-6 pt-4 sm:pt-5">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary">
                          {isAnonymous ? "Post Anonymously" : "Post Publicly"}
                        </span>
                        <p className="text-[11px] text-muted">
                          {isAnonymous
                            ? "Your name and avatar will be hidden"
                            : "Your identity will be visible to everyone"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-300 ${
                        isAnonymous
                          ? "bg-gradient-to-r from-amber-400 to-orange-400 shadow-md"
                          : "bg-border"
                      }`}
                    >
                      <div
                        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${
                          isAnonymous ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.02] to-transparent p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Users className="h-3.5 w-3.5" />
                    Your thread will be visible to the whole community
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      href="/forum"
                      className="inline-flex items-center justify-center rounded-full border border-border bg-white px-6 py-2.5 text-sm font-semibold text-muted transition-all duration-200 hover:border-primary/20 hover:text-primary"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brandGreen to-darkGreen px-8 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-brandGreen/20 transition-all duration-300 hover:shadow-xl hover:shadow-brandGreen/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {submitting ? (
                        <>
                          <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                          Publish Thread
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-7">
                {/* Tips */}
                <div className="animate-in fade-in slide-in-from-right-2 duration-500 rounded-2xl border border-brandGreen/15 bg-gradient-to-br from-brandGreen/[0.03] to-transparent p-5 shadow-card">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                      <Lightbulb className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-bold text-primary">Writing Tips</span>
                  </div>
                  <ul className="space-y-3">
                    {TIPS.map((tip, i) => {
                      const Icon = tip.icon;
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 text-sm leading-relaxed text-muted"
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brandGreen/10 text-[10px] font-bold text-brandGreen">
                            {i + 1}
                          </span>
                          {tip.text}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Live Preview */}
                <div className="animate-in fade-in slide-in-from-right-2 duration-500 rounded-2xl border border-border bg-white p-5 shadow-card">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyanAccent to-blue-600 text-white shadow-sm">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-bold text-primary">Live Preview</span>
                  </div>
                  {title || content || tags.length > 0 ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-pageBg/50 p-3">
                        <p className="text-sm font-bold text-primary line-clamp-1">
                          {title || (
                            <span className="text-muted/40 italic">Your title</span>
                          )}
                        </p>
                        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
                          {content || (
                            <span className="text-muted/40 italic">
                              Your content will appear here...
                            </span>
                          )}
                        </p>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-pageBg px-2 py-0.5 text-[10px] font-medium text-muted"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-pageBg/30 py-6 text-center">
                      <Sparkles className="h-5 w-5 text-muted/30" />
                      <p className="text-xs text-muted/40">
                        Start typing to see a preview
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
