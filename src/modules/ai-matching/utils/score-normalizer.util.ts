/**
 * Normalize a raw score into the 0–1 range.
 *
 * - Values already in 0–1 range are returned as-is.
 * - Values > 1 are treated as percentages (e.g., 75 → 0.75).
 * - Values below 0 are clamped to 0.
 * - Values above 1 (after percentage conversion) are clamped to 1.
 *
 * @param value - Raw score (e.g., 75, 0.75, 0.3).
 * @returns Normalized score clamped to [0, 1].
 */
export function normalizeScore(value: number): number {
  const normalized = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, normalized));
}

/**
 * Validate that a score falls within the standard 0–1 range.
 *
 * @param value - Score to validate.
 * @returns true when 0 <= value <= 1.
 */
export function validateScore(value: number): boolean {
  return value >= 0 && value <= 1;
}
