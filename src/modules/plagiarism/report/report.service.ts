import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AlgorithmScores,
  ComparisonDocument,
  MatchedChunk,
  MatchedPhrase,
  PlagiarismCheckResult,
  PlagiarismMatch,
  QualityAssessment,
  TextChunk,
} from '../types/plagiarism.types';
import { roundScore } from '../utils/math.utils';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { QualityAnalyzerService } from './quality-analyzer.service';

/** Input data required to build a plagiarism report. */
export interface ReportInput {
  inputText: string;
  inputChunks: TextChunk[];
  matches: PlagiarismMatch[];
  platformDocCount: number;
  internetDocCount: number;
}

/**
 * Builds structured plagiarism check reports with verdicts and quality scores.
 */
@Injectable()
export class ReportService {
  constructor(
    private readonly config: PlagiarismConfig,
    private readonly qualityAnalyzer: QualityAnalyzerService,
  ) {}

  /**
   * Generates a complete plagiarism check result from comparison data.
   */
  buildReport(input: ReportInput): PlagiarismCheckResult {
    const overallSimilarity =
      input.matches.length > 0 ? input.matches[0].similarity : 0;

    const averageSimilarity =
      input.matches.length > 0
        ? roundScore(
            input.matches.reduce((sum, m) => sum + m.similarity, 0) / input.matches.length,
          )
        : 0;

    const qualityAssessment = this.qualityAnalyzer.analyze(input.inputText, overallSimilarity);
    const qualityScore = this.qualityAnalyzer.computeQualityScore(qualityAssessment);

    return {
      checkId: randomUUID(),
      inputLength: input.inputText.length,
      overallSimilarity,
      maxSimilarity: overallSimilarity,
      averageSimilarity,
      matchCount: input.matches.length,
      verdict: this.config.resolveVerdict(overallSimilarity),
      qualityScore,
      qualityAssessment,
      sourcesChecked: input.platformDocCount,
      internetSourcesChecked: input.internetDocCount,
      matches: input.matches,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Builds a PlagiarismMatch from document comparison results.
   */
  buildMatch(
    doc: ComparisonDocument,
    documentSimilarity: number,
    algorithmScores: AlgorithmScores,
    matchedChunks: MatchedChunk[],
    matchedPhrases: MatchedPhrase[],
    matchedTokens: string[],
  ): PlagiarismMatch {
    return {
      sourceType: doc.sourceType,
      entityType: doc.entityType,
      entityId: doc.id,
      title: doc.title,
      similarity: roundScore(documentSimilarity),
      algorithmScores,
      matchedChunks,
      matchedPhrases: matchedPhrases.slice(0, 20),
      matchedTokens: matchedTokens.slice(0, 20),
      sourceUrl: doc.sourceUrl,
    };
  }
}
