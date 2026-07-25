/**
 * A recursive type representing any valid JSON value.
 * Useful for metadata payloads, raw LLM outputs, and vector DB attributes.
 */
export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
