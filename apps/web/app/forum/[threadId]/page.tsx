import { notFound } from 'next/navigation';
import ThreadView from '@/features/forum/ThreadView';
import { getThread } from '@/lib/forum-api';

export default async function ThreadDetailPage({ params }: { params: { threadId: string } }) {
  const thread = await getThread(params.threadId).catch(() => null);
  if (!thread) notFound();
  return <ThreadView thread={thread} />;
}
