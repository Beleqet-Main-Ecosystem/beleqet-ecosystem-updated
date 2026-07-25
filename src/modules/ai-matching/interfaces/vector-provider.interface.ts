import type { VectorSearchQuery, VectorSearchResult } from './vector-search.interface';
import type { Embedding } from './embedding.interface';

/**
 * Contract for performing vector-based candidate searches.
 *
 * Implementations wrap a vector database client (pgvector, Pinecone, Qdrant)
 * and handle queries, indexing, and embedding management.
 */
export interface VectorProvider {
  /**
   * Execute a vector search query against the candidate index.
   *
   * @param query - The search query including embedding, top-K, and filters.
   * @returns Ranked search results.
   */
  search(query: VectorSearchQuery): Promise<VectorSearchResult>;

  /**
   * Upsert (insert or update) embeddings for one or more freelancers.
   *
   * @param embeddings - The embeddings to store in the index.
   */
  upsert(embeddings: readonly Embedding[]): Promise<void>;

  /**
   * Remove embeddings for freelancers who are no longer eligible.
   *
   * @param freelancerIds - The freelancer IDs to remove from the index.
   */
  delete(freelancerIds: readonly string[]): Promise<void>;
}
