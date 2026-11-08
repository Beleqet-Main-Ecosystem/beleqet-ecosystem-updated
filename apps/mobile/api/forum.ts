/** Community forum. Same endpoints and limits as the website (lib/forum-api.ts, lib/config/forum.ts). */
import { get, send } from '../lib/api';

export const FORUM_LIMITS = { MIN_TITLE: 5, MAX_TITLE: 200, MIN_CONTENT: 20, MAX_CONTENT: 10000, MAX_TAGS: 10, MAX_TAG: 30 };

type Author = { id: string; firstName: string; lastName: string; avatarUrl: string | null };

export type ForumThread = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  userId: string | null;
  userDisplayName: string;
  isAnonymous: boolean;
  upvoteCount: number;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  user?: Author;
};

export type ForumReply = {
  id: string;
  content: string;
  threadId: string;
  parentReplyId: string | null;
  userId: string | null;
  userDisplayName: string;
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: string;
  user?: Author;
  childReplies?: ForumReply[];
};

export type ThreadPage = { items: ForumThread[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

export const fetchThreads = (params: { page?: number; limit?: number; sort?: string; search?: string; tag?: string }) =>
  get<ThreadPage>('/forum/threads', { ...params, search: params.search || undefined, tag: params.tag || undefined });
export const fetchThread = (id: string) => get<ForumThread & { replies: ForumReply[] }>(`/forum/threads/${encodeURIComponent(id)}`);
export const createThread = (data: { title: string; content: string; tags?: string[]; isAnonymous?: boolean }) => send<ForumThread>('POST', '/forum/threads', data);
export const createReply = (threadId: string, data: { content: string; parentReplyId?: string; isAnonymous?: boolean }) =>
  send<ForumReply>('POST', `/forum/threads/${encodeURIComponent(threadId)}/replies`, data);
export const upvoteThread = (id: string) => send<{ upvoted: boolean; upvoteCount: number }>('POST', `/forum/threads/${encodeURIComponent(id)}/upvote`);
export const upvoteReply = (id: string) => send<{ upvoted: boolean; upvoteCount: number }>('POST', `/forum/replies/${encodeURIComponent(id)}/upvote`);
