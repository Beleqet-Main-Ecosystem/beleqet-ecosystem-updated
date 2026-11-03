import PostJob from '@/features/jobs/components/PostJob';
import { fetchPostingCategories } from '@/lib/api';

type Props = { searchParams: Record<string, string | undefined> };

export default async function PostJobPage({ searchParams }: Props) {
  return <PostJob categories={await fetchPostingCategories()} editId={searchParams.edit || undefined} />;
}
