/**
 * Reorders an array by moving one item from `fromIndex` to `toIndex`.
 * Pure function — safe for builder state updates and unit tests.
 *
 * @param items - Source array (not mutated).
 * @param fromIndex - Current index of dragged item.
 * @param toIndex - Target index after drop.
 */
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

/**
 * Applies sequential orderIndex values after a reorder operation.
 *
 * @param items - Items with an orderIndex field.
 */
export function applyOrderIndices<T extends { orderIndex: number }>(
  items: T[],
): T[] {
  return items.map((item, index) => ({ ...item, orderIndex: index }));
}

/**
 * Sorts items by orderIndex ascending.
 *
 * @param items - Items carrying orderIndex.
 */
export function sortByOrderIndex<T extends { orderIndex: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}
