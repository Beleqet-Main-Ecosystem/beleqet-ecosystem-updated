import { Injectable } from '@nestjs/common';
import { TokenizerService } from '../tokenizer/tokenizer.service';

/** Number of top keywords to use for web search queries. */
const KEYWORD_COUNT = 6;

/**
 * Extracts meaningful keywords from input text for automatic web search.
 */
@Injectable()
export class KeywordExtractorService {
  constructor(private readonly tokenizer: TokenizerService) {}

  /**
   * Returns a search query built from the most frequent content tokens.
   */
  extractQuery(text: string): string {
    const tokens = this.tokenizer.tokenize(text);
    if (tokens.length === 0) return text.slice(0, 100);

    const frequency = new Map<string, number>();
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }

    const topKeywords = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEYWORD_COUNT)
      .map(([word]) => word);

    return topKeywords.join(' ');
  }
}
