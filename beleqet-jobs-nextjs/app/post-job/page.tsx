import PostJob from '@/features/jobs/components/PostJob';
import { fetchPostingCategories } from '@/lib/api';

export default async function PostJobPage() {
  return <PostJob categories={await fetchPostingCategories()} />;
}
