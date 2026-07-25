let counter = 0;

/**
 * Generates a stable-enough client-side id for list items.
 * Prefixed to avoid collisions with server ids later.
 */
export function createId(prefix = "item"): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

/**
 * Resets the id counter — used in tests for deterministic output.
 * @internal
 */
export function resetIdCounter(): void {
  counter = 0;
}
