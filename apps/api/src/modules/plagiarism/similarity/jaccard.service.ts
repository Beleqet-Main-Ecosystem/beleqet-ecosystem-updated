import { Injectable } from '@nestjs/common';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';

/**
 * Jaccard index: |A ∩ B| / |A ∪ B| over token sets.
 * Effective for detecting exact copying and shared vocabulary.
 */
@Injectable()
export class JaccardService implements ISimilarityAlgorithm {
  readonly name = 'jaccard' as const;

  constructor(private readonly tokenizer: TokenizerService) {}

  /**
   * Computes Jaccard similarity between two texts.
   */
  compare(textA: string, textB: string): SimilarityAlgorithmResult {
    const tokensA = new Set(this.tokenizer.tokenizeCached(textA));
    const tokensB = new Set(this.tokenizer.tokenizeCached(textB));

    if (tokensA.size === 0 && tokensB.size === 0) {
      return { score: 0, matchedTokens: [] };
    }

    const intersection: string[] = [];
    for (const token of tokensA) {
      if (tokensB.has(token)) {
        intersection.push(token);
      }
    }

    const unionSize = new Set([...tokensA, ...tokensB]).size;
    const score = unionSize === 0 ? 0 : intersection.length / unionSize;

    return { score, matchedTokens: intersection };
  }
}
