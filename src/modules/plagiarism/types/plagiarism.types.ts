/**
 * Where a matched document came from.
 */
export type MatchSourceType = 'platform' | 'internet';

/**
 * Quality label based on the highest similarity score found.
 */
export type QualityVerdict = 'original' | 'suspicious' | 'likely_plagiarized';

/**
 * Supported web search providers (configured via SEARCH_PROVIDER).
 */
export type SearchProvider = 'exa' | 'duckduckgo' | 'searxng';

/**
 * Individual algorithm scores for a comparison (0–1 each).
 */
export interface AlgorithmScores {
  jaccard: number;
  cosine: number;
  ngram: number;
  semantic: number;
}

/**
 * Configurable weights for score aggregation (must sum to 1).
 */
export interface SimilarityWeights {
  jaccard: number;
  cosine: number;
  ngram: number;
  semantic: number;
}

/**
 * A text chunk produced by the chunker for independent comparison.
 */
export interface TextChunk {
  index: number;
  text: string;
  type: 'paragraph' | 'sentence';
}

/**
 * A matched chunk pair between input and source document.
 */
export interface MatchedChunk {
  inputChunkIndex: number;
  sourceChunkIndex: number;
  inputText: string;
  sourceText: string;
  similarity: number;
  algorithmScores: AlgorithmScores;
}

/**
 * A matched phrase (n-gram) found in both texts.
 */
export interface MatchedPhrase {
  phrase: string;
  inputOccurrences: number;
  sourceOccurrences: number;
}

/**
 * A single document loaded for comparison.
 */
export interface ComparisonDocument {
  id: string;
  entityType: string;
  title: string;
  content: string;
  sourceType: MatchSourceType;
  sourceUrl?: string;
}

/**
 * One similarity match returned in a check report.
 */
export interface PlagiarismMatch {
  sourceType: MatchSourceType;
  entityType: string;
  entityId: string;
  title: string;
  similarity: number;
  algorithmScores: AlgorithmScores;
  matchedChunks: MatchedChunk[];
  matchedPhrases: MatchedPhrase[];
  /** @deprecated Use matchedPhrases instead. Kept for backward compatibility. */
  matchedTokens: string[];
  sourceUrl?: string;
}

/**
 * Quality assessment metrics for submitted text.
 */
export interface QualityAssessment {
  originality: number;
  professionalLanguage: number;
  readability: number;
  contentCompleteness: number;
  duplicateSentences: number;
  grammarWarnings: string[];
}

/**
 * Full plagiarism check result stored and returned to clients.
 */
export interface PlagiarismCheckResult {
  checkId: string;
  inputLength: number;
  overallSimilarity: number;
  /** @deprecated Use overallSimilarity. Kept for backward compatibility. */
  maxSimilarity: number;
  averageSimilarity: number;
  matchCount: number;
  verdict: QualityVerdict;
  qualityScore: number;
  qualityAssessment: QualityAssessment;
  sourcesChecked: number;
  internetSourcesChecked: number;
  matches: PlagiarismMatch[];
  checkedAt: string;
}

/**
 * Result of comparing two text segments with all algorithms.
 */
export interface ComparisonResult {
  similarity: number;
  algorithmScores: AlgorithmScores;
  matchedTokens: string[];
  matchedPhrases: MatchedPhrase[];
}

/**
 * Web search result before content is fetched.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}
