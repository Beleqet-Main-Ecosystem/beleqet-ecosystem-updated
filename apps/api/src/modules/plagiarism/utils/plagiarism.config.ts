import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchProvider, SimilarityWeights } from '../types/plagiarism.types';

/** Default similarity weights for score aggregation. */
const DEFAULT_WEIGHTS: SimilarityWeights = {
  jaccard: 0.2,
  cosine: 0.25,
  ngram: 0.2,
  semantic: 0.35,
};

/**
 * Centralized configuration for the plagiarism module.
 * All values are loaded from environment variables with sensible defaults.
 */
@Injectable()
export class PlagiarismConfig {
  readonly threshold: number;
  readonly enableWebSearch: boolean;
  readonly searchProvider: SearchProvider;
  readonly exaApiKey: string | undefined;
  readonly searxngUrl: string | undefined;
  readonly similarityWeights: SimilarityWeights;
  readonly maxPlatformDocuments: number;
  readonly maxWebResults: number;
  readonly verdictOriginalMax: number;
  readonly verdictSuspiciousMax: number;
  readonly earlyExitThreshold: number;
  readonly maxParagraphLength: number;
  readonly fetchTimeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.threshold = this.parseFloat('PLAGIARISM_THRESHOLD', 0.25);
    this.enableWebSearch = this.parseBool('ENABLE_WEB_SEARCH', true);
    this.searchProvider = this.parseSearchProvider();
    this.exaApiKey = this.config.get<string>('EXA_API_KEY');
    this.searxngUrl = this.config.get<string>('SEARXNG_URL');
    this.similarityWeights = this.parseWeights();
    this.maxPlatformDocuments = this.parseInt('MAX_PLATFORM_DOCUMENTS', 100);
    this.maxWebResults = this.parseInt('MAX_WEB_RESULTS', 5);
    this.verdictOriginalMax = this.parseFloat('VERDICT_ORIGINAL_MAX', 0.3);
    this.verdictSuspiciousMax = this.parseFloat('VERDICT_SUSPICIOUS_MAX', 0.6);
    this.earlyExitThreshold = this.parseFloat('EARLY_EXIT_THRESHOLD', 0.05);
    this.maxParagraphLength = this.parseInt('MAX_PARAGRAPH_LENGTH', 500);
    this.fetchTimeoutMs = this.parseInt('PLAGIARISM_FETCH_TIMEOUT_MS', 8000);
  }

  /**
   * Maps a similarity score to a human-readable verdict.
   */
  resolveVerdict(similarity: number): 'original' | 'suspicious' | 'likely_plagiarized' {
    if (similarity >= this.verdictSuspiciousMax) return 'likely_plagiarized';
    if (similarity >= this.verdictOriginalMax) return 'suspicious';
    return 'original';
  }

  private parseFloat(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined) return fallback;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseInt(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined) return fallback;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private parseBool(key: string, fallback: boolean): boolean {
    const raw = this.config.get<string>(key);
    if (raw === undefined) return fallback;
    return raw.toLowerCase() === 'true' || raw === '1';
  }

  private parseSearchProvider(): SearchProvider {
    const raw = (this.config.get<string>('SEARCH_PROVIDER') ?? 'duckduckgo').toLowerCase();
    if (raw === 'exa' || raw === 'searxng') return raw;
    return 'duckduckgo';
  }

  private parseWeights(): SimilarityWeights {
    const raw = this.config.get<string>('SIMILARITY_WEIGHTS');
    if (!raw) return { ...DEFAULT_WEIGHTS };

    try {
      const parsed = JSON.parse(raw) as Partial<SimilarityWeights>;
      return {
        jaccard: parsed.jaccard ?? DEFAULT_WEIGHTS.jaccard,
        cosine: parsed.cosine ?? DEFAULT_WEIGHTS.cosine,
        ngram: parsed.ngram ?? DEFAULT_WEIGHTS.ngram,
        semantic: parsed.semantic ?? DEFAULT_WEIGHTS.semantic,
      };
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  }
}
