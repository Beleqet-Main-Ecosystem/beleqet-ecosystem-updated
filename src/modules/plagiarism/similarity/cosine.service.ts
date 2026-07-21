import { Injectable } from '@nestjs/common';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { cosineSimilarity, termFrequency, tfToVector } from '../utils/math.utils';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';

/**
 * TF-IDF weighted cosine similarity for detecting similar wording patterns.
 * Runs entirely locally without external APIs.
 */
@Injectable()
export class CosineService implements ISimilarityAlgorithm {
  readonly name = 'cosine' as const;

  constructor(private readonly tokenizer: TokenizerService) {}

  /**
   * Computes cosine similarity using shared TF vectors from both texts.
   */
  compare(textA: string, textB: string): SimilarityAlgorithmResult {
    const tokensA = this.tokenizer.tokenizeCached(textA);
    const tokensB = this.tokenizer.tokenizeCached(textB);

    if (tokensA.length === 0 || tokensB.length === 0) {
      return { score: 0, matchedTokens: [] };
    }

    const tfA = termFrequency(tokensA);
    const tfB = termFrequency(tokensB);
    const vocabulary = [...new Set([...tfA.keys(), ...tfB.keys()])].sort();

    const vectorA = tfToVector(tfA, vocabulary);
    const vectorB = tfToVector(tfB, vocabulary);

    const idf = this.computeIdf([tfA, tfB], vocabulary);
    const weightedA = vectorA.map((v, i) => v * idf[i]);
    const weightedB = vectorB.map((v, i) => v * idf[i]);

    const score = cosineSimilarity(weightedA, weightedB);
    const matchedTokens = vocabulary.filter((term) => tfA.has(term) && tfB.has(term));

    return { score, matchedTokens };
  }

  /**
   * Computes inverse document frequency for the two-document corpus.
   */
  private computeIdf(docs: Map<string, number>[], vocabulary: string[]): number[] {
    const docCount = docs.length;
    return vocabulary.map((term) => {
      const docsWithTerm = docs.filter((doc) => doc.has(term)).length;
      return Math.log((docCount + 1) / (docsWithTerm + 1)) + 1;
    });
  }
}
