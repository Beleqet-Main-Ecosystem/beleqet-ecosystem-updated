import type { ScoredCandidate, CompositeScore, ScoreWeights } from './score.interface';
import type { LlmScore } from './score.interface';
import type { VectorScore } from './score.interface';

/**
 * Contract for computing composite scores from vector and LLM evaluation results.
 *
 * Implementations combine similarity scores with LLM confidence and
 * apply configurable weighting strategies.
 */
export interface Scoring {
  /**
   * Compute a composite score from a vector score and an optional LLM score.
   *
   * @param vectorScore - The similarity score from vector search (0–1).
   * @param llmScore - The LLM evaluation score, or null if stage 2 was bypassed.
   * @param weights - The weighting configuration to apply.
   * @returns The composite score breakdown.
   */
  computeCombinedScore(
    vectorScore: VectorScore,
    llmScore: LlmScore | null,
    weights: ScoreWeights,
  ): CompositeScore;

  /**
   * Assign composite scores to every candidate in a list.
   *
   * @param candidates - Scored candidates with raw vector and LLM scores.
   * @param weights - The weighting configuration to apply.
   * @returns The same candidates with composite scores populated.
   */
  scoreAll(
    candidates: readonly ScoredCandidate[],
    weights: ScoreWeights,
  ): Promise<readonly ScoredCandidate[]>;
}
