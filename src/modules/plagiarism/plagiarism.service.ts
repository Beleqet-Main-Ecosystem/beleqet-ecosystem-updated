import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { HistoryService } from './history/history.service';
import { SimilarityService } from './similarity.service.ts/similarity.service';
import { InternetSourceService } from './sources/internet-source.service';
import { PlatformSourceService } from './sources/platform-source.service';
import {
  ComparisonDocument,
  PlagiarismCheckResult,
  PlagiarismMatch,
  QualityVerdict,
} from './types/plagiarism.types';

/** Default minimum score to report a match. */
const DEFAULT_THRESHOLD = 0.25;

/** Verdict thresholds based on highest similarity found. */
const VERDICT_SUSPICIOUS = 0.35;
const VERDICT_PLAGIARIZED = 0.6;

/**
 * Orchestrates plagiarism checks against platform and internet sources.
 */
@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);

  constructor(
    private readonly similarityService: SimilarityService,
    private readonly platformSource: PlatformSourceService,
    private readonly internetSource: InternetSourceService,
    private readonly historyService: HistoryService,
  ) {}

  /**
   * Compares submitted text against platform DB content and optional web URLs.
   */
  async check(dto: CheckPlagiarismDto): Promise<PlagiarismCheckResult> {
    const threshold = dto.threshold ?? DEFAULT_THRESHOLD;
    const trimmedText = dto.text.trim();

    const [platformDocs, internetDocs] = await Promise.all([
      this.platformSource.loadDocuments(dto.excludeEntityId),
      dto.sourceUrls?.length
        ? this.internetSource.loadFromUrls(dto.sourceUrls)
        : Promise.resolve([]),
    ]);

    const allDocuments: ComparisonDocument[] = [...platformDocs, ...internetDocs];
    const matches = this.findMatches(trimmedText, allDocuments, threshold);
    const result = this.buildResult(trimmedText, matches);

    await this.historyService.save(result);

    this.logger.log(
      `Check ${result.checkId}: verdict=${result.verdict}, matches=${result.matchCount}`,
    );

    return result;
  }

  /**
   * Returns stored check history.
   */
  getHistory(limit = 20): Promise<PlagiarismCheckResult[]> {
    return this.historyService.findRecent(limit);
  }

  /**
   * Returns one stored check by ID.
   */
  getCheckById(checkId: string): Promise<PlagiarismCheckResult> {
    return this.historyService.findById(checkId);
  }

  /**
   * Compares input text against each document and keeps matches above threshold.
   */
  private findMatches(
    inputText: string,
    documents: ComparisonDocument[],
    threshold: number,
  ): PlagiarismMatch[] {
    const matches: PlagiarismMatch[] = [];

    for (const doc of documents) {
      const { score, matchedTokens } = this.similarityService.compare(
        inputText,
        doc.content,
      );

      if (score >= threshold) {
        matches.push({
          sourceType: doc.sourceType,
          entityType: doc.entityType,
          entityId: doc.id,
          title: doc.title,
          similarity: roundScore(score),
          matchedTokens: matchedTokens.slice(0, 20),
          sourceUrl: doc.sourceUrl,
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Builds the final report with quality verdict.
   */
  private buildResult(inputText: string, matches: PlagiarismMatch[]): PlagiarismCheckResult {
    const maxSimilarity = matches.length > 0 ? matches[0].similarity : 0;
    const averageSimilarity =
      matches.length > 0
        ? roundScore(matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length)
        : 0;

    return {
      checkId: randomUUID(),
      inputLength: inputText.length,
      maxSimilarity,
      averageSimilarity,
      matchCount: matches.length,
      verdict: this.resolveVerdict(maxSimilarity),
      matches,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Maps the highest similarity score to a human-readable quality label.
   */
  private resolveVerdict(maxSimilarity: number): QualityVerdict {
    if (maxSimilarity >= VERDICT_PLAGIARIZED) return 'likely_plagiarized';
    if (maxSimilarity >= VERDICT_SUSPICIOUS) return 'suspicious';
    return 'original';
  }
}

/** Rounds a score to 4 decimal places for consistent API output. */
function roundScore(score: number): number {
  return Math.round(score * 10_000) / 10_000;
}
