import { Injectable } from '@nestjs/common';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { ISimilarityStrategy, SimilarityResult } from './similarity.interface';

/**
 * Jaccard index: |A ∩ B| / |A ∪ B| over token sets.
 * Simple and fast for document-level plagiarism checks.
 */
@Injectable()
export class JaccardStrategy implements ISimilarityStrategy {
  constructor(private readonly tokenizer: TokenizerService) {}

  /**
   * Computes Jaccard similarity between two texts.
   */
  compare(textA: string, textB: string): SimilarityResult {
    const tokensA = new Set(this.tokenizer.tokenize(textA));
    const tokensB = new Set(this.tokenizer.tokenize(textB));

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
