import { notFound } from "next/navigation";
import { ArrowUp, Lock, ArrowLeft, Sparkles, MessageSquare, Flag } from "lucide-react";
import Link from "next/link";
import ReplySection from "@/components/forum/ReplySection";
import { getThread } from "@/lib/forum-api";

export const revalidate = 30;

interface Props {
  params: { threadId: string };
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function ThreadDetailPage({ params }: Props) {
  let thread;
  try {
    thread = await getThread(params.threadId);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Header */}
      <section className="bg-primary overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.07] hero-grid" />
        <div className="container-page relative py-10 sm:py-14">
          <Link
            href="/forum"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors duration-200 hover:text-[#d8ff3e]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Forum
          </Link>
        </div>
      </section>

      {/* Thread */}
      <section className="container-page -mt-6 pb-10 sm:pb-16">
        <article className="animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-[22px] border border-border bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {thread.isLocked && (
                <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-600 ring-1 ring-amber-200/50">
                  <Lock className="h-3 w-3" />
                  Locked
                </span>
              )}
              <h1 className="text-pageH1 text-primary">
                {thread.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  <span className="font-semibold text-ink">
                    {thread.userDisplayName}
                  </span>
                </span>
                <span className="text-muted/60">&middot;</span>
                <span>{timeAgo(thread.createdAt)}</span>
                <span className="text-muted/60">&middot;</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-pageBg px-4 py-2">
              <ArrowUp className="h-5 w-5 text-brandGreen" />
              <span className="text-xl font-black text-primary">{thread.upvoteCount}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <p className="leading-relaxed text-ink/85 whitespace-pre-line">
              {thread.content}
            </p>
          </div>

          {thread.tags && thread.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {thread.tags.map((tag: string) => (
                <Link
                  key={tag}
                  href={`/forum?tag=${tag}`}
                  className="rounded-full border border-border bg-pageBg px-3 py-1 text-[11px] font-medium text-muted transition-all duration-200 hover:border-brandGreen/40 hover:bg-brandGreen/5 hover:text-brandGreen"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </article>

        {/* Replies */}
        <section className="mt-8 animate-in fade-in duration-500" style={{ animationDelay: "150ms" }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sectionH2 text-primary">
              Replies
              <span className="ml-2 text-lg font-medium text-muted">
                ({thread.replies?.length ?? 0})
              </span>
            </h2>
            {!thread.isLocked && (
              <Link
                href={`/forum/${thread.id}?reply=true`}
                className="inline-flex items-center gap-2 rounded-full bg-brandGreen px-5 py-2.5 text-sm font-bold text-white transition-all duration-300 hover:bg-darkGreen hover:shadow-lg hover:-translate-y-0.5"
              >
                <Flag className="h-4 w-4" />
                Reply
              </Link>
            )}
          </div>
          <ReplySection replies={thread.replies ?? []} />
        </section>
      </section>
    </div>
  );
}
