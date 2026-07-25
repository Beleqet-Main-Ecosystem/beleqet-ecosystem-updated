import type { EmbeddingConfig } from './embedding.config';
import { defaultEmbeddingConfig } from './embedding.config';
import type { VectorSearchConfig } from './vector-search.config';
import { defaultVectorSearchConfig } from './vector-search.config';
import type { ScoringConfig } from './scoring.config';
import { defaultScoringConfig } from './scoring.config';
import type { LlmConfig } from './llm.config';
import { defaultLlmConfig } from './llm.config';
import type { LanguageConfig } from './language.config';
import { defaultLanguageConfig } from './language.config';

/**
 * Central configuration object for the complete AI Matching pipeline.
 *
 * All sub-configurations are strongly typed and immutable.
 * Services consume this object instead of hardcoded values.
 */
export interface AiMatchingConfig {
  /** Master toggle — the entire matching pipeline. */
  readonly enabled: boolean;

  /** Maximum number of candidates to return in the final result. */
  readonly maxCandidates: number;

  /** Default locale when none is provided in the request. */
  readonly defaultLocale: string;

  /** Default top-K for vector search when none is provided in request options. */
  readonly defaultTopK: number;

  /** Whether to perform LLM-based reranking after vector search. */
  readonly enableLlmReranking: boolean;

  /** Embedding generation settings. */
  readonly embedding: EmbeddingConfig;

  /** Vector search / retrieval settings. */
  readonly vectorSearch: VectorSearchConfig;

  /** Hybrid scoring settings. */
  readonly scoring: ScoringConfig;

  /** LLM evaluation settings. */
  readonly llm: LlmConfig;

  /** Multilingual support settings. */
  readonly language: LanguageConfig;
}

export const defaultAiMatchingConfig: AiMatchingConfig = {
  enabled: true,
  maxCandidates: 20,
  defaultLocale: 'en',
  defaultTopK: 20,
  enableLlmReranking: true,
  embedding: defaultEmbeddingConfig,
  vectorSearch: defaultVectorSearchConfig,
  scoring: defaultScoringConfig,
  llm: defaultLlmConfig,
  language: defaultLanguageConfig,
} as const;
