/**
 * Result of comparing two texts for similarity.
 */
export interface SimilarityResult {
  /** Jaccard score between 0 (no overlap) and 1 (identical token sets). */
  score: number;
  /** Tokens shared by both texts. */
  matchedTokens: string[];
}

/**
 * Contract for pluggable similarity algorithms.
 */
export interface ISimilarityStrategy {
  /**
   * Compares two texts and returns a similarity score.
   */
  compare(textA: string, textB: string): SimilarityResult;
}
