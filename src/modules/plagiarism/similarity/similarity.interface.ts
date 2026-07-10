/**
 * Result of a single similarity algorithm comparison.
 */
export interface SimilarityAlgorithmResult {
  score: number;
  matchedTokens?: string[];
  matchedPhrases?: { phrase: string; inputOccurrences: number; sourceOccurrences: number }[];
}

/**
 * Contract for pluggable similarity algorithms.
 */
export interface ISimilarityAlgorithm {
  /** Algorithm identifier matching AlgorithmScores keys. */
  readonly name: keyof import('../types/plagiarism.types').AlgorithmScores;

  /**
   * Compares two texts and returns a similarity score between 0 and 1.
   */
  compare(textA: string, textB: string): SimilarityAlgorithmResult | Promise<SimilarityAlgorithmResult>;
}
