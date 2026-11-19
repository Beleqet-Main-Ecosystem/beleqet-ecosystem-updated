/**
 * The project search lives in the URL (`/freelance?q=&category=&sort=&pricing=&budget=&level=`) so a search
 * can be shared and bookmarked. More results load in place, so there is no page parameter.
 */

export const GIG_PAGE_SIZE = 12;

export const GIG_SORTS = ['default', 'high', 'low'] as const;
export type GigSort = (typeof GIG_SORTS)[number];

export const GIG_PRICINGS = ['FIXED', 'HOURLY'] as const;
export const GIG_LEVELS = ['Entry', 'Intermediate', 'Expert'] as const;
/** Budget ranges in ETB. The API keeps a project whose own range overlaps the one picked. */
export const GIG_BUDGETS = {
  under5k: { max: 5000 },
  '5k-20k': { min: 5000, max: 20000 },
  '20k-50k': { min: 20000, max: 50000 },
  over50k: { min: 50000 },
} as const satisfies Record<string, { min?: number; max?: number }>;
export type GigBudget = keyof typeof GIG_BUDGETS;

export type GigSearch = {
  q: string;
  category: string;
  sort: GigSort;
  /** FIXED or HOURLY, or '' for both. */
  pricing: string;
  /** Entry, Intermediate or Expert, or '' for any. */
  level: string;
  budget: GigBudget | '';
};

/** The search's filters as the API names them. */
export function gigApiFilters(search: GigSearch) {
  const budget: { min?: number; max?: number } = search.budget ? GIG_BUDGETS[search.budget] : {};
  return {
    pricingType: search.pricing || undefined,
    experienceLevel: search.level || undefined,
    budgetMin: budget.min,
    budgetMax: budget.max,
  };
}

export function hasGigFilters(search: GigSearch): boolean {
  return Boolean(search.category || search.pricing || search.level || search.budget);
}

/** The API's name for each sort; the default (featured, then newest) sends nothing. */
export const API_SORT: Record<GigSort, 'budget_high' | 'budget_low' | undefined> = { default: undefined, high: 'budget_high', low: 'budget_low' };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export function parseGigSearch(raw: RawParams): GigSearch {
  const sort = first(raw.sort);
  const pricing = first(raw.pricing).toUpperCase();
  const level = GIG_LEVELS.find((item) => item.toLowerCase() === first(raw.level).toLowerCase()) ?? '';
  const budget = first(raw.budget);
  return {
    q: first(raw.q).slice(0, 100),
    category: first(raw.category).slice(0, 80),
    sort: (GIG_SORTS as readonly string[]).includes(sort) ? (sort as GigSort) : 'default',
    pricing: (GIG_PRICINGS as readonly string[]).includes(pricing) ? pricing : '',
    level,
    budget: budget in GIG_BUDGETS ? (budget as GigBudget) : '',
  };
}

export function gigSearchHref(search: GigSearch, change: Partial<GigSearch> = {}): string {
  const next = { ...search, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.category) params.set('category', next.category);
  if (next.sort !== 'default') params.set('sort', next.sort);
  if (next.pricing) params.set('pricing', next.pricing);
  if (next.budget) params.set('budget', next.budget);
  if (next.level) params.set('level', next.level);
  const query = params.toString();
  return query ? `/freelance?${query}` : '/freelance';
}

/** Translated name when we have one, otherwise the name from the API. */
export function categoryLabel(category: { slug: string; label: string }, t: (key: string) => string): string {
  const key = `freelance.cats.${category.slug}`;
  const translated = t(key);
  return translated === key ? category.label : translated;
}
