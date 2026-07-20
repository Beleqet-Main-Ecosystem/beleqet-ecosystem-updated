import { Injectable } from '@nestjs/common';
import { STOP_WORDS } from './stop-words';
import { ITokenizer } from './tokenizer.interface';

/** Basic French stop words for multilingual support. */
const FRENCH_STOP_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'est', 'dans', 'pour',
  'que', 'qui', 'sur', 'avec', 'pas', 'plus', 'par', 'ce', 'cette', 'ses', 'son',
  'sa', 'nos', 'notre', 'vos', 'votre', 'leur', 'leurs', 'au', 'aux', 'en',
]);

/** Combined stop words for English and French. */
const ALL_STOP_WORDS = new Set([...STOP_WORDS, ...FRENCH_STOP_WORDS]);

/** Minimum token length after normalization. */
const MIN_TOKEN_LENGTH = 3;

/**
 * Splits text into normalized word tokens with stop-word removal and unicode normalization.
 */
@Injectable()
export class TokenizerService implements ITokenizer {
  private readonly cache = new Map<string, string[]>();

  /**
   * Normalizes text and returns content tokens suitable for comparison.
   */
  tokenize(text: string): string[] {
    const normalized = text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) return [];

    return normalized
      .split(/\s+/)
      .filter((word) => word.length >= MIN_TOKEN_LENGTH && !ALL_STOP_WORDS.has(word));
  }

  /**
   * Returns cached tokens for repeated comparisons against the same text.
   */
  tokenizeCached(text: string): string[] {
    const cached = this.cache.get(text);
    if (cached) return cached;

    const tokens = this.tokenize(text);
    this.cache.set(text, tokens);
    return tokens;
  }

  /**
   * Clears the internal token cache (useful in long-running processes).
   */
  clearCache(): void {
    this.cache.clear();
  }
}
