import type { Category } from '@/lib/api';

/**
 * The fields we put first wherever categories are listed (landing page,
 * search filters), in this order, when the API has them. The API has 55.
 */
export const FEATURED_CATEGORY_SLUGS = [
  'accounting-and-finance',
  'software-design-and-development',
  'sales-and-promotion',
  'creative-art-and-design',
  'human-resource-and-talent-management',
  'construction-and-civil-engineering',
  'health-care',
  'teaching-and-tutor',
] as const;

/** Featured categories present in `categories`, in featured order. */
export function featuredCategories(categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return FEATURED_CATEGORY_SLUGS.flatMap((slug) => (byId.has(slug) ? [byId.get(slug)!] : []));
}

/** Translated label when we have one (`landing.categories.<slug>`), else the API's English label. */
export function categoryLabel(category: Category, t: (key: string) => string): string {
  const key = `landing.categories.${category.id}`;
  const translated = t(key);
  return translated === key ? category.label : translated;
}
