import ForumList from '@/features/forum/ForumList';
import { FORUM_CONFIG } from '@/lib/config/forum';
import { getThreads, type ForumThread, type PaginatedResponse } from '@/lib/forum-api';

export const revalidate = FORUM_CONFIG.CACHE.REVALIDATE_SECONDS;

type Props = { searchParams: Record<string, string | undefined> };

export default async function ForumPage({ searchParams }: Props) {
  const query = {
    search: searchParams.search ?? '',
    tag: searchParams.tag ?? '',
    sort: searchParams.sort ?? '',
    page: Number(searchParams.page) > 1 ? Number(searchParams.page) : 1,
  };
  const data = await getThreads({
    page: query.page,
    limit: FORUM_CONFIG.PAGINATION.DEFAULT_LIMIT,
    sort: query.sort || undefined,
    search: query.search || undefined,
    tag: query.tag || undefined,
  }).catch((): PaginatedResponse<ForumThread> | null => null);

  return <ForumList key={JSON.stringify(query)} query={query} data={data} />;
}
