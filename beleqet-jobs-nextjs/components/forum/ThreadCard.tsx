import Link from "next/link";
import { MessageSquare, ArrowUp, Pin, Sparkles } from "lucide-react";
import type { ForumThread } from "@/lib/forum-api";

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ThreadCard({ thread }: { thread: ForumThread }) {
  return (
    <article className="group flex min-h-[280px] flex-col rounded-[22px] border border-primary/10 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-brandGreen/30 hover:shadow-cardHover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col">
          {thread.isPinned && (
            <span className="mb-1.5 flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 ring-1 ring-amber-200/50">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
          <Link href={`/forum/${thread.id}`} className="group/link">
            <h3 className="text-cardH3 line-clamp-2 leading-snug text-primary transition-colors duration-200 group-hover/link:text-brandGreen">
              {thread.title}
            </h3>
          </Link>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandGreen/10 text-brandGreen transition-all duration-300 group-hover:scale-110 group-hover:bg-brandGreen group-hover:text-white">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted/90">
        {thread.content}
      </p>

      {thread.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {thread.tags.map((tag) => (
            <Link
              key={tag}
              href={`/forum?tag=${tag}`}
              className="rounded-full border border-border bg-pageBg px-2.5 py-1 text-[11px] font-medium text-muted transition-all duration-200 hover:border-brandGreen/40 hover:bg-brandGreen/5 hover:text-brandGreen"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-primary/10 pt-3 text-[11px] text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 transition-colors duration-200">
            <ArrowUp className="h-3.5 w-3.5 text-muted/60" />
            <span className="font-semibold">{thread.upvoteCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-muted/60" />
            <span className="font-semibold">{thread.replyCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted/70">
          <span className="truncate max-w-[120px]">{thread.userDisplayName}</span>
          <span aria-label={new Date(thread.createdAt).toLocaleDateString()}>
            {timeAgo(thread.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
