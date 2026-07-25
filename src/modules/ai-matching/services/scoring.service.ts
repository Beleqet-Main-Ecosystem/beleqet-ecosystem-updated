import { Inject, Injectable } from '@nestjs/common';
import type { Scoring } from '../interfaces/scoring.interface';
import type {
  VectorScore,
  LlmScore,
  ScoreWeights,
  CompositeScore,
  ScoredCandidate,
} from '../interfaces/score.interface';
import type { ScoringConfig } from '../config/scoring.config';
import { normalizeScore } from '../utils/score-normalizer.util';

/** Coerce NaN/Infinity to zero so arithmetic never produces NaN. */
function toFinite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * Deterministic engine that combines vector similarity scores with
 * LLM evaluation scores into a weighted CompositeScore.
 *
 * When an LLM score is absent (null), the vector score represents
 * 100 % of the combined score.
 */
@Injectable()
export class ScoringService implements Scoring {
  private readonly defaultWeights: ScoreWeights;

  constructor(@Inject('SCORING_CONFIG') private readonly scoringConfig: ScoringConfig) {
    this.defaultWeights = {
      vector: this.scoringConfig.weights.vector,
      llm: this.scoringConfig.weights.llm,
    };
  }

  /**
   * Compute a weighted composite score from vector and optional LLM scores.
   *
   * @param vectorScore - Raw similarity score from vector search.
   * @param llmScore    - LLM evaluation score, or null when bypassed / failed.
   * @param weights     - Weighting configuration (must sum to 1).
   * @returns CompositeScore with breakdown and final combined score.
   */
  computeCombinedScore(
    vectorScore: VectorScore,
    llmScore: LlmScore | null,
    weights: ScoreWeights,
  ): CompositeScore {
    const vectorComponent = normalizeScore(toFinite(vectorScore.score));

    if (llmScore === null) {
      return {
        vectorScore: vectorComponent,
        llmScore: null,
        combinedScore: vectorComponent,
      };
    }

    const llmComponent = normalizeScore(toFinite(llmScore.calibratedConfidence));
    const combined = normalizeScore(
      vectorComponent * toFinite(weights.vector) + llmComponent * toFinite(weights.llm),
    );

    return {
      vectorScore: vectorComponent,
      llmScore: llmComponent,
      combinedScore: combined,
    };
  }

  /**
   * Assign composite scores to every candidate in a batch.
   *
   * Iterates over candidates and computes a CompositeScore for each one
   * using the provided weights. Does not filter or rank — pure scoring.
   *
   * @param candidates - Scored candidates with populated vector / LLM scores.
   * @param weights    - Weighting configuration. Falls back to injected defaults
   *                     when omitted (maintained for callers that don't customise).
   * @returns The same candidate list with `compositeScore` populated.
   */
  async scoreAll(
    candidates: readonly ScoredCandidate[],
    weights?: ScoreWeights,
  ): Promise<readonly ScoredCandidate[]> {
    const w = weights ?? this.defaultWeights;

    return candidates.map((candidate) => ({
      ...candidate,
      compositeScore: this.computeCombinedScore(candidate.vectorScore, candidate.llmScore, w),
    }));
  }
}
