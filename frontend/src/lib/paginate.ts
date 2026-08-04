/** Default page size for the Admin Stats recent-projects table. */
export const RECENT_PROJECTS_PAGE_SIZE = 8;

export interface PageSlice<T> {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  items: T[];
  fromIndex: number;
  toIndex: number;
}

/**
 * Returns a safe 1-based page slice for list UIs (recent projects, etc.).
 */
export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number = RECENT_PROJECTS_PAGE_SIZE,
): PageSlice<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * size;
  const sliced = items.slice(start, start + size);

  return {
    page: safePage,
    totalPages,
    pageSize: size,
    totalItems,
    items: sliced,
    fromIndex: totalItems === 0 ? 0 : start + 1,
    toIndex: totalItems === 0 ? 0 : start + sliced.length,
  };
}
