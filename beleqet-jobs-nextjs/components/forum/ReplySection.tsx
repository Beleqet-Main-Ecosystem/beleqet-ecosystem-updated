"use client";

import { useState } from "react";
import { ArrowUp, ChevronDown, ChevronRight, User } from "lucide-react";
import type { ForumReply } from "@/lib/forum-api";
import { toggleReplyUpvote } from "@/lib/forum-api";

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ReplyCard({ reply, token, depth = 0 }: { reply: ForumReply; token?: string; depth?: number }) {
  const [upvoteCount, setUpvoteCount] = useState(reply.upvoteCount);
  const [upvoted, setUpvoted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = reply.childReplies && reply.childReplies.length > 0;

  const handleUpvote = async () => {
    if (!token) return;
    try {
      const res = await toggleReplyUpvote(reply.id, token);
      setUpvoteCount(res.upvoteCount);
      setUpvoted(res.upvoted);
    } catch {
      // silently fail
    }
  };

  return (
    <div
      className={`animate-in fade-in slide-in-from-left-2 duration-300 [animation-fill-mode:both]`}
      style={{ animationDelay: `${depth * 50}ms` }}
    >
      <div
        className={`group rounded-2xl border bg-white p-4 transition-all duration-200 hover:shadow-card ${
          depth === 0
            ? "border-border shadow-sm"
            : "border-border/60 shadow-none"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
                <User className="h-3 w-3" />
              </span>
              <span className="font-semibold text-ink">
                {reply.userDisplayName}
              </span>
              <span className="text-muted/60">&middot;</span>
              <span className="text-muted/60">{timeAgo(reply.createdAt)}</span>
            </div>
            <p className="text-sm leading-relaxed text-ink/85">
              {reply.content}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            <button
              onClick={handleUpvote}
              disabled={!token}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold transition-all duration-200 ${
                upvoted
                  ? "text-brandGreen bg-brandGreen/10"
                  : "text-muted/50 hover:text-brandGreen hover:bg-brandGreen/5"
              } ${!token ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
              title={token ? "Upvote" : "Log in to upvote"}
            >
              <ArrowUp
                className={`h-4 w-4 transition-transform duration-200 ${
                  upvoted ? "fill-brandGreen translate-y-[-2px]" : ""
                }`}
              />
              {upvoteCount}
            </button>
          </div>
        </div>

        {hasChildren && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-brandGreen transition-colors duration-200"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {reply.childReplies!.length} {reply.childReplies!.length === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <div className="ml-4 sm:ml-6 mt-2 space-y-2 border-l-2 border-brandGreen/20 pl-3 sm:pl-5">
          {reply.childReplies!.map((child, i) => (
            <ReplyCard
              key={child.id}
              reply={child}
              token={token}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReplySection({
  replies,
  token,
}: {
  replies: ForumReply[];
  token?: string;
}) {
  if (replies.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white/50 px-6 py-12 text-center animate-in fade-in duration-500">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pageBg text-muted">
          <ArrowUp className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-muted">
          No replies yet. Be the first to respond!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply, i) => (
        <div
          key={reply.id}
          className="animate-in fade-in slide-in-from-bottom-2 duration-400"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <ReplyCard reply={reply} token={token} />
        </div>
      ))}
    </div>
  );
}
