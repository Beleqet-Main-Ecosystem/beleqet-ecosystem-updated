/**
 * Safely parse a JSON string without throwing.
 * Returns null for any parse failure.
 *
 * @param value - Raw JSON string to parse.
 * @returns Parsed value of type T, or null on failure.
 */
export function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Extract the first top-level JSON object `{...}` from arbitrary text.
 * Handles cases where an LLM wraps JSON in markdown code fences or natural language.
 *
 * @param text - Text that may contain a JSON object.
 * @returns The matched JSON string (including braces), or null if nothing found.
 */
export function extractJsonObject(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}
