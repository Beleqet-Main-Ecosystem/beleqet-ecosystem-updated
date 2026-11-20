import { Injectable } from '@nestjs/common';
import { MatchedPhrase } from '../types/plagiarism.types';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';

/** N-gram sizes used for phrase-level comparison. */
const NGRAM_SIZES = [3, 4];

/**
 * Character-level n-gram similarity for detecting copied phrases.
 * Compares 3-gram and 4-gram sets using Jaccard index.
 */
@Injectable()
export class NgramService implements ISimilarityAlgorithm {
  readonly name = 'ngram' as const;

  /**
   * Computes blended 3-gram and 4-gram Jaccard similarity.
   */
  compare(textA: string, textB: string): SimilarityAlgorithmResult {
    const normalizedA = this.normalizeForNgrams(textA);
    const normalizedB = this.normalizeForNgrams(textB);

    if (normalizedA.length < 3 || normalizedB.length < 3) {
      return { score: 0, matchedPhrases: [] };
    }

    let totalScore = 0;
    const allMatchedPhrases: MatchedPhrase[] = [];

    for (const size of NGRAM_SIZES) {
      const ngramsA = this.buildNgrams(normalizedA, size);
      const ngramsB = this.buildNgrams(normalizedB, size);
      const { score, matched } = this.jaccardNgrams(ngramsA, ngramsB);
      totalScore += score;

      for (const phrase of matched) {
        allMatchedPhrases.push({
          phrase,
          inputOccurrences: ngramsA.get(phrase) ?? 0,
          sourceOccurrences: ngramsB.get(phrase) ?? 0,
        });
      }
    }

    const score = totalScore / NGRAM_SIZES.length;
    return { score, matchedPhrases: allMatchedPhrases.slice(0, 20) };
  }

  /**
   * Normalizes text for character n-gram extraction.
   */
  private normalizeForNgrams(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Builds a frequency map of character n-grams from text.
   */
  private buildNgrams(text: string, size: number): Map<string, number> {
    const ngrams = new Map<string, number>();
    for (let i = 0; i <= text.length - size; i++) {
      const gram = text.slice(i, i + size);
      ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
    }
    return ngrams;
  }

  /**
   * Computes Jaccard similarity between two n-gram frequency maps.
   */
  private jaccardNgrams(
    a: Map<string, number>,
    b: Map<string, number>,
  ): { score: number; matched: string[] } {
    const matched: string[] = [];
    let intersection = 0;
    let union = 0;

    const allKeys = new Set([...a.keys(), ...b.keys()]);
    for (const key of allKeys) {
      const countA = a.get(key) ?? 0;
      const countB = b.get(key) ?? 0;
      intersection += Math.min(countA, countB);
      union += Math.max(countA, countB);
      if (countA > 0 && countB > 0) {
        matched.push(key);
      }
    }

    return { score: union === 0 ? 0 : intersection / union, matched };
  }
}
