import PostJob from '@/features/jobs/components/PostJob';
import { fetchPostingCategories } from '@/lib/api';

type Props = { searchParams: Record<string, string | undefined> };

/** The website's job form inside the Mini App, returning to the Mini App's employer home. */
export default async function MiniAppPostJob({ searchParams }: Props) {
  return (
    <div className="px-1 pb-6">
      <PostJob categories={await fetchPostingCategories()} editId={searchParams.edit || undefined} dashboardHref="/tg/employer" />
    </div>
  );
}
