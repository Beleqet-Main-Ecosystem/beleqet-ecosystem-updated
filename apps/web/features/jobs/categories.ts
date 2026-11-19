import type { Category } from '@/lib/api';

/** How many categories to put first (landing page, search filters). */
export const FEATURED_COUNT = 8;

/**
 * The categories with the most open jobs right now, busiest first, from the database (no fixed
 * list). Categories without open jobs are left out, so nothing leads to an empty search.
 */
export function featuredCategories(categories: Category[]): Category[] {
  return categories
    .filter((category) => (category.openJobs ?? 0) > 0)
    .sort((a, b) => (b.openJobs ?? 0) - (a.openJobs ?? 0) || a.label.localeCompare(b.label))
    .slice(0, FEATURED_COUNT);
}

/** Translated label when we have one (`landing.categories.<slug>`), else the API's English label. */
export function categoryLabel(category: Category, t: (key: string) => string): string {
  const key = `landing.categories.${category.id}`;
  const translated = t(key);
  return translated === key ? category.label : translated;
}
