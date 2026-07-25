import { Inject, Injectable } from '@nestjs/common';
import type { RerankingProvider } from '../interfaces/reranking-provider.interface';
import type { ScoredCandidate } from '../interfaces/score.interface';
import type { RankedCandidate } from '../interfaces/match-result.interface';
import type { ScoringConfig } from '../config/scoring.config';

const EPSILON = 0.000001;

/**
 * Sorts scored candidates by composite score descending, applies
 * tie-breaking (higher vector score wins), truncates to maxResults,
 * and assigns 1-based ranks.
 */
@Injectable()
export class RankingService implements RerankingProvider {
  constructor(@Inject('SCORING_CONFIG') private readonly scoringConfig: ScoringConfig) {}
  /**
   * Rerank scored candidates and produce a sorted, ranked list.
   *
   * Sorting criteria (descending):
   * 1. compositeScore.combinedScore
   * 2. vectorScore.score (tiebreaker)
   *
   * @param candidates - Candidates with composite scores populated.
   * @param maxResults - Maximum number of candidates in the returned list.
   * @returns Ranked candidates with 1-based ranks.
   */
  async rerank(
    candidates: readonly ScoredCandidate[],
    maxResults: number,
  ): Promise<readonly RankedCandidate[]> {
    const sorted = [...candidates]
      .filter((c) => c.compositeScore.combinedScore >= this.scoringConfig.minimumMatchScore)
      .sort((a, b) => {
        const scoreDiff = b.compositeScore.combinedScore - a.compositeScore.combinedScore;
        if (Math.abs(scoreDiff) > EPSILON) return scoreDiff;
        return b.vectorScore.score - a.vectorScore.score;
      })
      .slice(0, maxResults);

    return sorted.map((c, i) => ({
      freelancerId: c.freelancerId,
      freelancerName: '',
      rank: i + 1,
      combinedScore: c.compositeScore.combinedScore,
      decision: c.decision ?? 'PENDING',
      reasoningSnippet: '',
      matchedSkills: c.matchedSkills,
      skillGaps: [],
    }));
  }
}
