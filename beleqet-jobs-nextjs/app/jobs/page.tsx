import type { JobType } from '@beleqet/common';
import JobSearch from '@/features/jobs/components/JobSearch';
import { PAGE_SIZE, parseJobSearch } from '@/features/jobs/search-params';
import { fetchCategories, searchJobs, type JobSearchResult } from '@/lib/api';
import { jobsPageMetadata } from '@/lib/seo/generate-metadata';

export const metadata = jobsPageMetadata();

type Props = { searchParams: Record<string, string | string[] | undefined> };

/**
 * Server-rendered per search: the query string decides the results, so every
 * filter, page and shared link hits the API's search rather than filtering a
 * small prefetched list in the browser.
 */
export default async function JobsPage({ searchParams }: Props) {
  const search = parseJobSearch(searchParams);

  const [result, categories] = await Promise.all([
    searchJobs({
      q: search.q || undefined,
      location: search.loc || undefined,
      category: search.category || undefined,
      // parseJobSearch only lets through values that are JobType members.
      type: (search.type || undefined) as JobType | undefined,
      page: search.page,
      limit: PAGE_SIZE,
    })
      // An unreachable API shows an error state with a retry, not a crash page.
      .catch((): JobSearchResult | null => null),
    fetchCategories(),
  ]);

  return <JobSearch search={search} result={result} categories={categories} />;
}
