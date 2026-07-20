import { Injectable } from '@nestjs/common';
import { AlgorithmScores, ComparisonResult, MatchedPhrase, SimilarityWeights } from '../types/plagiarism.types';
import { roundScore } from '../utils/math.utils';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { CosineService } from './cosine.service';
import { JaccardService } from './jaccard.service';
import { NgramService } from './ngram.service';
import { SemanticService } from './semantic.service';

/**
 * Combines individual algorithm scores into a single weighted similarity score.
 */
@Injectable()
export class ScoreAggregatorService {
  constructor(private readonly config: PlagiarismConfig) {}

  /**
   * Computes weighted aggregate score from individual algorithm scores.
   */
  aggregate(scores: AlgorithmScores, weights: SimilarityWeights = this.config.similarityWeights): number {
    const weighted =
      scores.jaccard * weights.jaccard +
      scores.cosine * weights.cosine +
      scores.ngram * weights.ngram +
      scores.semantic * weights.semantic;

    return roundScore(Math.max(0, Math.min(1, weighted)));
  }

  /**
   * Builds a ComparisonResult from raw algorithm outputs.
   */
  buildResult(
    scores: AlgorithmScores,
    matchedTokens: string[],
    matchedPhrases: MatchedPhrase[],
  ): ComparisonResult {
    return {
      similarity: this.aggregate(scores),
      algorithmScores: {
        jaccard: roundScore(scores.jaccard),
        cosine: roundScore(scores.cosine),
        ngram: roundScore(scores.ngram),
        semantic: roundScore(scores.semantic),
      },
      matchedTokens,
      matchedPhrases,
    };
  }
}

/**
 * Runs all similarity algorithms on a text pair and aggregates the result.
 */
@Injectable()
export class SimilarityEngineService {
  constructor(
    private readonly jaccard: JaccardService,
    private readonly cosine: CosineService,
    private readonly ngram: NgramService,
    private readonly semantic: SemanticService,
    private readonly aggregator: ScoreAggregatorService,
    private readonly config: PlagiarismConfig,
  ) {}

  /**
   * Compares two text segments using all algorithms with optional early exit.
   */
  async compare(textA: string, textB: string, skipSemantic = false): Promise<ComparisonResult> {
    const jaccardResult = this.jaccard.compare(textA, textB);
    const cosineResult = this.cosine.compare(textA, textB);
    const ngramResult = this.ngram.compare(textA, textB);

    const quickScore =
      jaccardResult.score * 0.4 + cosineResult.score * 0.3 + ngramResult.score * 0.3;

    let semanticScore = 0;
    if (!skipSemantic && quickScore >= this.config.earlyExitThreshold) {
      const semanticResult = await this.semantic.compare(textA, textB);
      semanticScore = semanticResult.score;
    }

    const scores: AlgorithmScores = {
      jaccard: jaccardResult.score,
      cosine: cosineResult.score,
      ngram: ngramResult.score,
      semantic: semanticScore,
    };

    const matchedTokens = [
      ...new Set([...(jaccardResult.matchedTokens ?? []), ...(cosineResult.matchedTokens ?? [])]),
    ];

    const matchedPhrases = ngramResult.matchedPhrases ?? [];

    return this.aggregator.buildResult(scores, matchedTokens, matchedPhrases);
  }
}
