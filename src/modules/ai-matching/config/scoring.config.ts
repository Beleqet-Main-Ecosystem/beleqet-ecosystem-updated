/**
 * Weights applied to each scoring stage when computing the composite match score.
 * Values are expected to be in the 0–1 range and should sum to 1.
 */
export interface ScoringWeights {
  /** Weight for the vector similarity score component. */
  readonly vector: number;

  /** Weight for the LLM evaluation score component. */
  readonly llm: number;
}

/**
 * Configuration for the hybrid scoring stage.
 */
export interface ScoringConfig {
  /** Relative weights for vector and LLM score components. */
  readonly weights: ScoringWeights;

  /** Minimum combined score (0–1) for a candidate to appear in final results. */
  readonly minimumMatchScore: number;
}

export const defaultScoringConfig: ScoringConfig = {
  weights: {
    vector: 0.4,
    llm: 0.6,
  },
  minimumMatchScore: 0.2,
} as const;
