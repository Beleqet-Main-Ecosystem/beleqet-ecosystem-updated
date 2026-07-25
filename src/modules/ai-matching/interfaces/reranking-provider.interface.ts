import type { ScoredCandidate } from './score.interface';
import type { RankedCandidate } from './match-result.interface';

/**
 * Contract for sorting scored candidates by composite score and producing
 * a ranked list.
 *
 * Implementations sort by composite score (descending), apply tie-breaking
 * rules, truncate to the configured limit, and assign 1-based ranks.
 *
 * This contract does NOT construct the final MatchResult — that
 * responsibility belongs to a separate mapper/response layer.
 */
export interface RerankingProvider {
  /**
   * Rerank scored candidates and produce a sorted ranked list.
   *
   * @param candidates - Candidates with composite scores assigned.
   * @param maxResults - Maximum number of candidates to include.
   * @returns Ranked candidates, sorted by composite score descending.
   */
  rerank(
    candidates: readonly ScoredCandidate[],
    maxResults: number,
  ): Promise<readonly RankedCandidate[]>;
}
