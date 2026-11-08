'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Lock } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getToken } from '@/lib/auth';
import { createReply, toggleReplyUpvote, toggleThreadUpvote, type ForumReply, type ForumThread } from '@/lib/forum-api';
import { useTranslation } from '@/lib/i18n';
import { postedAgo } from '@/features/jobs/format';
import { forumCard, forumSolid } from './ForumList';
import ReportButton from '@/features/reports/ReportButton';
import { authenticatedFetch } from '@/lib/auth';
import { errorText } from '@/lib/api-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const MAX_REPLY = 5000;

function Vote({ count, onVote, label, big }: { count: number; onVote: () => Promise<number | null>; label: string; big?: boolean }) {
  const { user } = useAuth();
  const [value, setValue] = useState(count);
  return (
    <button
      type="button"
      disabled={!user}
      aria-label={label}
      title={label}
      onClick={async () => {
        const next = await onVote();
        if (next !== null) setValue(next);
      }}
      className={`inline-flex items-center gap-1 rounded-lg border border-ink-200 font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:text-white ${big ? 'min-h-14 w-12 flex-col justify-center text-base' : 'min-h-9 px-2 text-[13px]'}`}
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
      {value}
    </button>
  );
}

function ReplyItem({ reply, locked, onReply, depth = 0 }: { reply: ForumReply; locked: boolean; onReply: (reply: ForumReply) => void; depth?: number }) {
  const { t, locale } = useTranslation();
  const vote = async () => {
    const token = getToken();
    if (!token) return null;
    return toggleReplyUpvote(reply.id, token).then((result) => result.upvoteCount).catch(() => null);
  };
  return (
    <li className={depth > 0 ? 'border-l-2 border-ink-200 pl-3.5 dark:border-slate-800' : ''}>
      <div className="flex flex-col gap-1.5 py-3">
        <span className="text-[13px] text-ink-500 dark:text-slate-400"><b className="text-ink-900 dark:text-white">{reply.isAnonymous ? t('forum.anonymous') : reply.userDisplayName}</b> · {postedAgo(reply.createdAt, locale, '')}</span>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{reply.content}</p>
        <span className="flex items-center gap-2">
          <Vote count={reply.upvoteCount} onVote={vote} label={t('forum.upvote')} />
          {!locked && <button type="button" onClick={() => onReply(reply)} className="min-h-9 px-2 text-[13px] font-bold text-forest dark:text-limeAccent">{t('forum.replyAction')}</button>}
          <ReportButton targetType="FORUM_REPLY" targetId={reply.id} />
        </span>
      </div>
      {reply.childReplies && reply.childReplies.length > 0 && (
        <ul>
          {reply.childReplies.map((child) => (
            <ReplyItem key={child.id} reply={child} locked={locked} onReply={onReply} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function addReply(list: ForumReply[], reply: ForumReply): ForumReply[] {
  if (!reply.parentReplyId) return [...list, reply];
  return list.map((item) =>
    item.id === reply.parentReplyId
      ? { ...item, childReplies: [...(item.childReplies ?? []), reply] }
      : { ...item, childReplies: addReply(item.childReplies ?? [], reply) },
  );
}

export default function ThreadView({ thread }: { thread: ForumThread & { replies: ForumReply[] } }) {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const [replies, setReplies] = useState(thread.replies);
  const [count, setCount] = useState(thread.replyCount);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [parent, setParent] = useState<ForumReply | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [pinned, setPinned] = useState(thread.isPinned);
  const [locked, setLocked] = useState(thread.isLocked);
  const isAdmin = user?.role === 'ADMIN';

  // Admins pin a thread to the top of the list, or lock it against new replies.
  async function moderate(change: { isPinned?: boolean; isLocked?: boolean }) {
    setError('');
    const response = await authenticatedFetch(`${API_URL}/forum/threads/${thread.id}/moderation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
    }).catch(() => null);
    if (!response?.ok) {
      setError(t('forum.modFailed'));
      return;
    }
    if (change.isPinned !== undefined) setPinned(change.isPinned);
    if (change.isLocked !== undefined) setLocked(change.isLocked);
  }

  const voteThread = async () => {
    const token = getToken();
    if (!token) return null;
    return toggleThreadUpvote(thread.id, token).then((result) => result.upvoteCount).catch(() => null);
  };

  async function send() {
    const token = getToken();
    if (!token || !text.trim()) return;
    setSending(true);
    setError('');
    try {
      const reply = await createReply(thread.id, { content: text.trim(), parentReplyId: parent?.id, isAnonymous: anonymous }, token);
      setReplies(addReply(replies, { ...reply, childReplies: [] }));
      setCount(count + 1);
      setText('');
      setParent(null);
    } catch (problem) {
      setError(errorText(problem, t, 'forum.replyFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[860px] flex-col gap-2 px-4 pb-7 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-9 md:pt-8">
          <nav aria-label={t('freelance.contract.breadcrumb')} className="text-[13px] text-white/70">
            <Link href="/forum" className="hover:underline">{t('forum.title')}</Link>
          </nav>
          {locked && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold"><Lock className="h-3 w-3" aria-hidden="true" />{t('forum.locked')}</span>
          )}
          <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em] md:text-[32px]">{thread.title}</h1>
        </div>
      </section>

      <div className="mx-auto flex max-w-[860px] flex-col gap-4 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16">
        <article className={`${forumCard} flex gap-3.5`}>
          <Vote big count={thread.upvoteCount} onVote={voteThread} label={t('forum.upvote')} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-[13px] text-ink-500 dark:text-slate-400"><b className="text-ink-900 dark:text-white">{thread.isAnonymous ? t('forum.anonymous') : thread.userDisplayName}</b> · {postedAgo(thread.createdAt, locale, '')}</span>
            <p className="whitespace-pre-line text-base leading-[1.7] text-ink-700 dark:text-slate-300">{thread.content}</p>
            {thread.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
                {thread.tags.map((tag) => (
                  <Link key={tag} href={`/forum?tag=${encodeURIComponent(tag)}`} prefetch={false} className="text-forest hover:underline dark:text-limeAccent">#{tag}</Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <ReportButton targetType="FORUM_THREAD" targetId={thread.id} />
              {isAdmin && (
                <>
                  <button type="button" onClick={() => moderate({ isPinned: !pinned })} className="min-h-9 text-[13px] font-bold text-forest hover:underline dark:text-limeAccent">
                    {t(pinned ? 'forum.unpin' : 'forum.pin')}
                  </button>
                  <button type="button" onClick={() => moderate({ isLocked: !locked })} className="min-h-9 text-[13px] font-bold text-forest hover:underline dark:text-limeAccent">
                    {t(locked ? 'forum.unlock' : 'forum.lock')}
                  </button>
                </>
              )}
            </div>
          </div>
        </article>

        <section aria-labelledby="replies-h" className={forumCard}>
          <h2 id="replies-h" className="pb-1 text-lg font-bold text-ink-900 dark:text-white">{t(count === 1 ? 'forum.reply' : 'forum.replies').replace('{count}', String(count))}</h2>
          {replies.length === 0 ? (
            <p className="py-2 text-sm text-ink-500 dark:text-slate-300">{t('forum.noReplies')}</p>
          ) : (
            <ul className="divide-y divide-[#F1F4F6] dark:divide-slate-800">
              {replies.map((reply) => (
                <ReplyItem key={reply.id} reply={reply} locked={locked} onReply={setParent} />
              ))}
            </ul>
          )}
        </section>

        {locked ? (
          <p className={`${forumCard} text-sm text-ink-700 dark:text-slate-300`}>{t('forum.lockedText')}</p>
        ) : ready && !user ? (
          <p className={`${forumCard} text-sm text-ink-700 dark:text-slate-300`}>
            <Link href={`/login?next=${encodeURIComponent(`/forum/${thread.id}`)}`} className="font-bold text-forest hover:underline dark:text-limeAccent">{t('forum.signIn')}</Link>
          </p>
        ) : user ? (
          <form
            aria-labelledby="reply-h"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className={`${forumCard} flex flex-col gap-2.5`}
          >
            <h2 id="reply-h" className="text-base font-bold text-ink-900 dark:text-white">
              {parent ? t('forum.replyTo').replace('{name}', parent.isAnonymous ? t('forum.anonymous') : parent.userDisplayName) : t('forum.yourReply')}
            </h2>
            {parent && <button type="button" onClick={() => setParent(null)} className="self-start text-[13px] font-bold text-forest dark:text-limeAccent">{t('forum.clear')}</button>}
            <textarea
              rows={4}
              aria-label={t('forum.yourReply')}
              maxLength={MAX_REPLY}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t('forum.replyPlaceholder')}
              className="resize-y rounded-lg border border-ink-300 bg-surface p-3 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-forest dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-slate-300">
                <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="h-5 w-5 accent-primary" />
                {t('forum.replyAnon')}
              </label>
              <span className="flex items-center gap-3">
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{text.length.toLocaleString('en-US')} / 5,000</span>
                <button type="submit" disabled={sending || !text.trim()} className={forumSolid}>{t('forum.postReply')}</button>
              </span>
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          </form>
        ) : null}

        <section className={`${forumCard} flex flex-col gap-1.5`}>
          <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('forum.related')}</h2>
          <Link href="/tax-calculator" className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('forum.relatedTax')} →</Link>
        </section>
      </div>
    </>
  );
}
