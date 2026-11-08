import type { Metadata } from 'next';
import GigSearchPage from '@/features/freelance/components/GigSearchPage';
import { API_SORT, gigApiFilters, GIG_PAGE_SIZE, parseGigSearch } from '@/features/freelance/search-params';
import { fetchGigCategories, searchGigs, type GigSearchResult } from '@/lib/api';
import { freelancePageMetadata } from '@/lib/seo/generate-metadata';

export const metadata: Metadata = freelancePageMetadata();

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function FreelancePage({ searchParams }: Props) {
  const search = parseGigSearch(searchParams);
  const [result, categories] = await Promise.all([
    searchGigs({
      q: search.q || undefined,
      category: search.category || undefined,
      sort: API_SORT[search.sort],
      ...gigApiFilters(search),
      page: 1,
      limit: GIG_PAGE_SIZE,
    })
      // An unreachable API shows an error state with a retry, not a crash page.
      .catch((): GigSearchResult | null => null),
    fetchGigCategories(),
  ]);

  // Keyed so a new search or sort starts again from its first page of results.
  return (
    <GigSearchPage
      key={`${search.q}|${search.category}|${search.sort}`}
      search={search}
      result={result}
      categories={categories}
    />
  );
}
