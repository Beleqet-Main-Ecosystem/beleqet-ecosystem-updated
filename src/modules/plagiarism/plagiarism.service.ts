import { Injectable, Logger } from '@nestjs/common';
import { CheckPlagiarismDto } from './dto/check-plagiarism.dto';
import { ChunkerService } from './chunker/chunker.service';
import { HistoryService } from './history/history.service';
import { InternetSourceService } from './internet/internet-source.service';
import { PlatformSourceService } from './platform/platform-source.service';
import { ReportService } from './report/report.service';
import { SimilarityEngineService } from './similarity/score-aggregator.service';
import {
  AlgorithmScores,
  ComparisonDocument,
  MatchedChunk,
  MatchedPhrase,
  PlagiarismMatch,
  PlagiarismCheckResult,
  TextChunk,
} from './types/plagiarism.types';
import { NormalizationService } from './utils/normalization.service';
import { PlagiarismConfig } from './utils/plagiarism.config';
import { roundScore } from './utils/math.utils';

/**
 * Orchestrates the full plagiarism detection pipeline:
 * normalize → chunk → collect sources → compare → aggregate → report → history.
 */
@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);

  constructor(
    private readonly config: PlagiarismConfig,
    private readonly normalization: NormalizationService,
    private readonly chunker: ChunkerService,
    private readonly similarityEngine: SimilarityEngineService,
    private readonly platformSource: PlatformSourceService,
    private readonly internetSource: InternetSourceService,
    private readonly reportService: ReportService,
    private readonly historyService: HistoryService,
  ) {}

  /**
   * Compares submitted text against platform content and internet sources.
   */
  async check(dto: CheckPlagiarismDto): Promise<PlagiarismCheckResult> {
    const threshold = dto.threshold ?? this.config.threshold;
    const normalizedText = this.normalization.normalize(dto.text.trim());
    const inputChunks = this.chunker.chunk(normalizedText);

    const [platformDocs, internetDocsFromSearch, internetDocsFromUrls] = await Promise.all([
      this.platformSource.loadDocuments(dto.excludeEntityId),
      this.internetSource.loadFromSearch(normalizedText),
      dto.sourceUrls?.length
        ? this.internetSource.loadFromUrls(dto.sourceUrls)
        : Promise.resolve([]),
    ]);

    const internetDocs = this.deduplicateDocuments([
      ...internetDocsFromSearch,
      ...internetDocsFromUrls,
    ]);

    const allDocuments = [...platformDocs, ...internetDocs];
    const matches = await this.findMatches(inputChunks, allDocuments, threshold);

    const result = this.reportService.buildReport({
      inputText: normalizedText,
      inputChunks,
      matches,
      platformDocCount: platformDocs.length,
      internetDocCount: internetDocs.length,
    });

    await this.historyService.save(result);

    this.logger.log(
      `Check ${result.checkId}: verdict=${result.verdict}, matches=${result.matchCount}, overall=${result.overallSimilarity}`,
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
   * Compares input chunks against all documents in parallel.
   */
  private async findMatches(
    inputChunks: TextChunk[],
    documents: ComparisonDocument[],
    threshold: number,
  ): Promise<PlagiarismMatch[]> {
    const matchResults = await Promise.all(
      documents.map((doc) => this.compareDocument(inputChunks, doc, threshold)),
    );

    return matchResults
      .filter((m): m is PlagiarismMatch => m !== null)
      .sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Compares input chunks against a single source document.
   */
  private async compareDocument(
    inputChunks: TextChunk[],
    doc: ComparisonDocument,
    threshold: number,
  ): Promise<PlagiarismMatch | null> {
    const sourceChunks = this.chunker.chunk(doc.content);
    if (sourceChunks.length === 0) return null;

    const matchedChunks: MatchedChunk[] = [];
    const allPhrases: MatchedPhrase[] = [];
    const allTokens: string[] = [];
    const scoreAccumulator: AlgorithmScores = { jaccard: 0, cosine: 0, ngram: 0, semantic: 0 };
    let bestChunkScore = 0;
    let comparisonCount = 0;

    for (const inputChunk of inputChunks) {
      for (const sourceChunk of sourceChunks) {
        const quickJaccard = await this.similarityEngine.compare(
          inputChunk.text,
          sourceChunk.text,
          true,
        );

        if (quickJaccard.similarity < this.config.earlyExitThreshold) continue;

        const result = await this.similarityEngine.compare(
          inputChunk.text,
          sourceChunk.text,
        );

        comparisonCount++;
        if (result.similarity > bestChunkScore) {
          bestChunkScore = result.similarity;
        }

        if (result.similarity >= threshold) {
          matchedChunks.push({
            inputChunkIndex: inputChunk.index,
            sourceChunkIndex: sourceChunk.index,
            inputText: inputChunk.text,
            sourceText: sourceChunk.text,
            similarity: result.similarity,
            algorithmScores: result.algorithmScores,
          });
        }

        allPhrases.push(...result.matchedPhrases);
        allTokens.push(...result.matchedTokens);

        scoreAccumulator.jaccard += result.algorithmScores.jaccard;
        scoreAccumulator.cosine += result.algorithmScores.cosine;
        scoreAccumulator.ngram += result.algorithmScores.ngram;
        scoreAccumulator.semantic += result.algorithmScores.semantic;
      }
    }

    if (comparisonCount === 0) return null;

    const avgScores: AlgorithmScores = {
      jaccard: scoreAccumulator.jaccard / comparisonCount,
      cosine: scoreAccumulator.cosine / comparisonCount,
      ngram: scoreAccumulator.ngram / comparisonCount,
      semantic: scoreAccumulator.semantic / comparisonCount,
    };

    const documentSimilarity = roundScore(
      matchedChunks.length > 0
        ? matchedChunks.reduce((max, c) => Math.max(max, c.similarity), 0)
        : bestChunkScore,
    );

    if (documentSimilarity < threshold) return null;

    const uniquePhrases = this.deduplicatePhrases(allPhrases);
    const uniqueTokens = [...new Set(allTokens)];

    return this.reportService.buildMatch(
      doc,
      documentSimilarity,
      {
        jaccard: roundScore(avgScores.jaccard),
        cosine: roundScore(avgScores.cosine),
        ngram: roundScore(avgScores.ngram),
        semantic: roundScore(avgScores.semantic),
      },
      matchedChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 10),
      uniquePhrases,
      uniqueTokens,
    );
  }

  /**
   * Removes duplicate documents by ID.
   */
  private deduplicateDocuments(docs: ComparisonDocument[]): ComparisonDocument[] {
    const seen = new Set<string>();
    return docs.filter((doc) => {
      if (seen.has(doc.id)) return false;
      seen.add(doc.id);
      return true;
    });
  }

  /**
   * Deduplicates matched phrases by phrase text.
   */
  private deduplicatePhrases(phrases: MatchedPhrase[]): MatchedPhrase[] {
    const map = new Map<string, MatchedPhrase>();
    for (const phrase of phrases) {
      const existing = map.get(phrase.phrase);
      if (!existing || phrase.inputOccurrences > existing.inputOccurrences) {
        map.set(phrase.phrase, phrase);
      }
    }
    return [...map.values()];
  }
}
