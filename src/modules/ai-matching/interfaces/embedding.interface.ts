import type { Job } from './job.interface';

/**
 * A dense vector embedding produced by an embedding model.
 * Immutable after creation.
 */
export interface Embedding {
  /** The embedding vector values. */
  readonly vector: readonly number[];

  /** Name of the model that produced this embedding. */
  readonly model: string;

  /** Dimensionality of the vector. */
  readonly dimensions: number;

  /** The entity (user / freelancer / job) this embedding belongs to. */
  readonly freelancerId?: string;

  /** The target database table this embedding should be written to (required for upsert). */
  readonly entityType?: 'freelancer' | 'freelanceJob' | 'job';
}

/**
 * The result of generating an embedding from source text.
 */
export interface EmbeddingResult {
  /** The generated embedding vector. */
  readonly embedding: Embedding;

  /** The source text that was embedded. */
  readonly sourceText: string;

  /** Number of tokens consumed by the embedding model. */
  readonly tokenCount: number;

  /** Latency of the embedding generation in milliseconds. */
  readonly latencyMs: number;
}

/**
 * Parameters for generating an embedding from a job.
 */
export interface EmbeddingRequest {
  /** The job to embed. */
  readonly job: Job;

  /** Preferred embedding model (overrides the default). */
  readonly preferredModel?: string;
}
