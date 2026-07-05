/**
 * Where a matched document came from.
 */
export type MatchSourceType = 'platform' | 'internet';

/**
 * Quality label based on the highest similarity score found.
 */
export type QualityVerdict = 'original' | 'suspicious' | 'likely_plagiarized';

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
  matchedTokens: string[];
  sourceUrl?: string;
}

/**
 * Full plagiarism check result stored and returned to clients.
 */
export interface PlagiarismCheckResult {
  checkId: string;
  inputLength: number;
  maxSimilarity: number;
  averageSimilarity: number;
  matchCount: number;
  verdict: QualityVerdict;
  matches: PlagiarismMatch[];
  checkedAt: string;
}
