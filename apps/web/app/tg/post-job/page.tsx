import PostJobWizard from '@/features/miniapp/PostJobWizard';
import { fetchPostingCategories } from '@/lib/api';

type Props = { searchParams: Record<string, string | undefined> };

/** Posting (or editing) a job in the Mini App, one step at a time. */
export default async function MiniAppPostJob({ searchParams }: Props) {
  return <PostJobWizard categories={await fetchPostingCategories()} editId={searchParams.edit || undefined} />;
}
