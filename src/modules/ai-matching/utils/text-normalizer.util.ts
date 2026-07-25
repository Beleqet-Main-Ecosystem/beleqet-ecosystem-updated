/**
 * Normalize text for embedding generation and comparison.
 * Trims whitespace, collapses multiple spaces, normalizes line breaks, and lowercases.
 *
 * @param text - Raw input text.
 * @returns Normalized, trimmed, lowercase text.
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .toLowerCase();
}

/**
 * Normalize a skill name for consistent comparison and matching.
 *
 * @param skill - Raw skill string (e.g., " React.js ").
 * @returns Trimmed, lowercase skill name (e.g., "react.js").
 */
export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

/**
 * Normalize every item in a string array, removing empty entries while preserving order.
 *
 * @param values - Array of raw text strings.
 * @returns Filtered array with each item normalized.
 */
export function normalizeTextArray(values: readonly string[]): readonly string[] {
  return values.map(normalizeText).filter((v) => v.length > 0);
}
