/**
 * The project search lives in the URL (`/freelance?q=&category=&sort=`) so a search
 * can be shared and bookmarked. More results load in place, so there is no page parameter.
 */

export const GIG_PAGE_SIZE = 12;

export const GIG_SORTS = ['default', 'high', 'low'] as const;
export type GigSort = (typeof GIG_SORTS)[number];

export type GigSearch = { q: string; category: string; sort: GigSort };

/** The API's name for each sort; the default (featured, then newest) sends nothing. */
export const API_SORT: Record<GigSort, 'budget_high' | 'budget_low' | undefined> = { default: undefined, high: 'budget_high', low: 'budget_low' };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export function parseGigSearch(raw: RawParams): GigSearch {
  const sort = first(raw.sort);
  return {
    q: first(raw.q).slice(0, 100),
    category: first(raw.category).slice(0, 80),
    sort: (GIG_SORTS as readonly string[]).includes(sort) ? (sort as GigSort) : 'default',
  };
}

export function gigSearchHref(search: GigSearch, change: Partial<GigSearch> = {}): string {
  const next = { ...search, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  if (next.sort !== 'default') params.set('sort', next.sort);
  const query = params.toString();
  return query ? `/freelance?${query}` : '/freelance';
}

/** Translated name when we have one, otherwise the name from the API. */
export function categoryLabel(category: { slug: string; label: string }, t: (key: string) => string): string {
  const key = `freelance.cats.${category.slug}`;
  const translated = t(key);
  return translated === key ? category.label : translated;
}
