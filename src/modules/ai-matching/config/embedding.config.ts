/**
 * Configuration for embedding generation.
 * Controls which model is used, vector dimensionality, input limits, and provider selection.
 */
export interface EmbeddingConfig {
  /** The embedding model identifier (provider-specific). */
  readonly model: string;

  /** Dimensionality of the generated embedding vectors. */
  readonly dimensions: number;

  /** Maximum number of input characters/tokens the model accepts. */
  readonly maxInputLength: number;

  /** Logical provider key — resolved at the provider layer. */
  readonly provider: string;
}

export const defaultEmbeddingConfig: EmbeddingConfig = {
  model: 'text-embedding-model',
  dimensions: 1536,
  maxInputLength: 8000,
  provider: 'default',
} as const;
