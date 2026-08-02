/**
 * Merges auction-ranked campaign target ids to the front of an organic result list.
 * Dedupes by id; preserves organic order for non-boosted items.
 */
export function prependBoostedIds<T extends { id: string }>(
  organic: T[],
  boostedTargetIds: string[],
  decorate?: (item: T) => T,
): T[] {
  if (boostedTargetIds.length === 0) return organic;

  const byId = new Map(organic.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const head: T[] = [];

  for (const id of boostedTargetIds) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    seen.add(id);
    head.push(decorate ? decorate(item) : item);
  }

  const rest = organic.filter((item) => !seen.has(item.id));
  return [...head, ...rest];
}
