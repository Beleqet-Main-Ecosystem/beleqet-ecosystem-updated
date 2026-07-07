const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  tags: string[];
  userId: string;
  userDisplayName: string;
  isAnonymous: boolean;
  upvoteCount: number;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
}

export interface ForumReply {
  id: string;
  content: string;
  threadId: string;
  parentReplyId: string | null;
  userId: string;
  userDisplayName: string;
  isAnonymous: boolean;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
  childReplies?: ForumReply[];
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getThreads(params?: {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  tag?: string;
}): Promise<PaginatedResponse<ForumThread>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.sort) qs.set("sort", params.sort);
  if (params?.search) qs.set("search", params.search);
  if (params?.tag) qs.set("tag", params.tag);
  const query = qs.toString();
  return fetchJson(`${API}/forum/threads${query ? `?${query}` : ""}`);
}

export async function getThread(id: string): Promise<ForumThread & { replies: ForumReply[] }> {
  return fetchJson(`${API}/forum/threads/${id}`);
}

export async function createThread(
  data: { title: string; content: string; tags?: string[]; isAnonymous?: boolean },
  token: string,
): Promise<ForumThread> {
  return fetchJson(`${API}/forum/threads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function createReply(
  threadId: string,
  data: { content: string; parentReplyId?: string; isAnonymous?: boolean },
  token: string,
): Promise<ForumReply> {
  return fetchJson(`${API}/forum/threads/${threadId}/replies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function toggleThreadUpvote(threadId: string, token: string) {
  return fetchJson<{ upvoted: boolean; upvoteCount: number }>(
    `${API}/forum/threads/${threadId}/upvote`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function toggleReplyUpvote(replyId: string, token: string) {
  return fetchJson<{ upvoted: boolean; upvoteCount: number }>(
    `${API}/forum/replies/${replyId}/upvote`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );
}
