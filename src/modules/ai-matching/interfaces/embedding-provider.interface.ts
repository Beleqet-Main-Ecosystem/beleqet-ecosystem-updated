import type { Job as _Job } from './job.interface';
import type { EmbeddingResult, EmbeddingRequest } from './embedding.interface';

/**
 * Contract for generating vector embeddings from text.
 *
 * Implementations wrap an embedding model provider (OpenAI, local model, etc.)
 * and are responsible for tokenisation, API calls, and returning structured
 * embedding results.
 */
export interface EmbeddingProvider {
  /**
   * Generate an embedding vector from a raw text string.
   *
   * @param text - The source text to embed.
   * @returns The embedding result containing the vector and metadata.
   */
  generateEmbedding(text: string): Promise<EmbeddingResult>;

  /**
   * Generate an embedding for a full job posting, including title,
   * description, and any concatenated metadata.
   *
   * @param request - Embedding request containing the job and optional model preference.
   * @returns The embedding result.
   */
  generateEmbeddingForJob(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
