/**
 * The job search lives in the URL (`/jobs?q=&loc=&category=&type=&page=`) so a
 * search can be shared, bookmarked and navigated with the back button. These
 * helpers are the only place that reads or writes those parameters.
 */

export const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'REMOTE', 'HYBRID', 'CONTRACT'] as const;
export type JobTypeCode = (typeof JOB_TYPES)[number];

/** Quick location picks; the API matches location as "contains", case-insensitive. */
export const QUICK_LOCATIONS = ['Addis Ababa', 'Adama', 'Hawassa', 'Bahir Dar', 'Dire Dawa', 'Mekelle'];

export const PAGE_SIZE = 20;

export type JobSearch = {
  q: string;
  loc: string;
  category: string;
  type: JobTypeCode | '';
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export function parseJobSearch(raw: RawParams): JobSearch {
  const type = first(raw.type).toUpperCase();
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: first(raw.q).slice(0, 100),
    loc: first(raw.loc).slice(0, 60),
    category: first(raw.category).slice(0, 80),
    type: (JOB_TYPES as readonly string[]).includes(type) ? (type as JobTypeCode) : '',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** Builds `/jobs?…` for a search; empty values and page 1 are left out. */
export function jobSearchHref(search: JobSearch, changes: Partial<JobSearch> = {}): string {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.loc) params.set('loc', next.loc);
  if (next.category) params.set('category', next.category);
  if (next.type) params.set('type', next.type);
  if (next.page > 1) params.set('page', String(next.page));
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : '/jobs';
}

/** Page links to show: first, last, and one either side of the current page (1 … 4 5 6 … 170). */
export function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (['gap', p] as const) : [p]));
}

export function hasFilters(search: JobSearch): boolean {
  return Boolean(search.loc || search.category || search.type);
}
