import type { EvaluationDecision } from './evaluation.interface';

/**
 * The raw similarity score from the vector search stage.
 */
export interface VectorScore {
  /** Cosine similarity score (0–1). */
  readonly score: number;
}

/**
 * The refined score from the LLM evaluation stage.
 */
export interface LlmScore {
  /** Raw confidence from the LLM (0–1). */
  readonly confidence: number;

  /**
   * Calibrated confidence adjusted by historical accuracy.
   * Equals `confidence` when calibration data is insufficient.
   */
  readonly calibratedConfidence: number;
}

/**
 * The weighted composite score combining vector and LLM scores.
 * Represents the calculated result only — configuration (weights)
 * is kept in the separate ScoreWeights contract.
 */
export interface CompositeScore {
  /** Vector similarity score component. */
  readonly vectorScore: number;

  /** LLM score component (null if stage 2 was bypassed). */
  readonly llmScore: number | null;

  /** Weighted combination of vector and LLM scores (0–1). */
  readonly combinedScore: number;
}

/**
 * Weights applied to each scoring stage when computing the composite.
 * Kept as a separate contract for use by the configuration layer.
 */
export interface ScoreWeights {
  /** Weight for the vector similarity score. */
  readonly vector: number;

  /** Weight for the LLM evaluation score. */
  readonly llm: number;
}

/**
 * A scored candidate during the scoring and ranking stages.
 */
export interface ScoredCandidate {
  /** The freelancer identifier. */
  readonly freelancerId: string;

  /** Vector search score. */
  readonly vectorScore: VectorScore;

  /** LLM evaluation score (null if bypassed or pending). */
  readonly llmScore: LlmScore | null;

  /** The combined composite score. */
  readonly compositeScore: CompositeScore;

  /** Match decision from the LLM. */
  readonly decision: EvaluationDecision | null;

  /** Skills that matched between job and freelancer. */
  readonly matchedSkills: readonly string[];
}
