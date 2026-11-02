/**
 * The project search lives in the URL (`/freelance?q=&category=`) so a search
 * can be shared and bookmarked. More results load in place, so there is no page parameter.
 */

export const GIG_PAGE_SIZE = 12;

/** The API has no public category list yet, so these mirror the freelance categories in the database. */
export const GIG_CATEGORIES = ['web-development', 'graphic-design', 'writing', 'digital-marketing', 'video-animation'] as const;

export type GigSearch = { q: string; category: string };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export function parseGigSearch(raw: RawParams): GigSearch {
  const category = first(raw.category);
  return {
    q: first(raw.q).slice(0, 100),
    category: (GIG_CATEGORIES as readonly string[]).includes(category) ? category : '',
  };
}

export function gigSearchHref(search: GigSearch, change: Partial<GigSearch> = {}): string {
  const next = { ...search, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  const query = params.toString();
  return query ? `/freelance?${query}` : '/freelance';
}
