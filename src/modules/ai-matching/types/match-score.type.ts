/**
 * Branded type for a matching score constrained to the 0–1 range.
 * Represents cosine similarity, LLM confidence, or a composite value.
 */
export type MatchScore = number & { readonly __brand: 'MatchScore' };
