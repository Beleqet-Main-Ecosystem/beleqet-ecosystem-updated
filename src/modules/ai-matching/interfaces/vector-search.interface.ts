import type { JsonValue } from '../types/json-value.type';

/**
 * Query parameters for a vector search against the candidate index.
 */
export interface VectorSearchQuery {
  /** The embedding vector to search with. */
  readonly embedding: readonly number[];

  /** Maximum number of candidates to return. */
  readonly topK: number;

  /** Minimum cosine similarity score (0–1) to include a candidate. */
  readonly minScore: number;

  /** Optional pre-filters applied before the vector search. */
  readonly filters?: VectorSearchFilters;
}

/**
 * Pre-filters applied to narrow the search space before vector comparison.
 */
export interface VectorSearchFilters {
  /** Minimum hourly rate filter. */
  readonly minHourlyRate?: number;

  /** Maximum hourly rate filter. */
  readonly maxHourlyRate?: number;

  /** Candidates must possess all of these skills. */
  readonly requiredSkills?: readonly string[];

  /** Candidates to exclude (e.g., those who opted out). */
  readonly excludedFreelancerIds?: readonly string[];
}

/**
 * A single result from a vector search.
 */
export interface VectorSearchHit {
  /** The freelancer identifier. */
  readonly freelancerId: string;

  /** Cosine similarity score (0–1). */
  readonly score: number;

  /** The stored embedding of the matched candidate. */
  readonly embedding: readonly number[];

  /** Additional metadata stored alongside the embedding (optional, JSON-safe). */
  readonly metadata?: JsonValue;
}

/**
 * The complete result of a vector search operation.
 */
export interface VectorSearchResult {
  /** The candidates returned by the search, ranked by score descending. */
  readonly hits: readonly VectorSearchHit[];

  /** The query that produced these results. */
  readonly query: VectorSearchQuery;

  /** Total candidates in the index matching the filters (before top-K). */
  readonly totalCandidates: number;

  /** Latency of the vector search in milliseconds. */
  readonly latencyMs: number;
}
