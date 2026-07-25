/**
 * Configuration for the vector search / retrieval stage.
 * Values are provider-agnostic — the same shape works for pgvector, Qdrant, Pinecone, etc.
 */
export interface VectorSearchConfig {
  /** Maximum number of candidates to retrieve from the vector index. */
  readonly topK: number;

  /** Minimum cosine similarity threshold (0–1) to include a candidate. */
  readonly minimumSimilarityScore: number;

  /** Hard upper bound on returned results regardless of topK. */
  readonly maxSearchResults: number;

  /** Vector search query timeout in milliseconds. */
  readonly timeoutMs: number;
}

export const defaultVectorSearchConfig: VectorSearchConfig = {
  topK: 20,
  minimumSimilarityScore: 0.3,
  maxSearchResults: 50,
  timeoutMs: 3000,
} as const;
