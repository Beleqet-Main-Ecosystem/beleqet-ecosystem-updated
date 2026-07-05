import { Injectable } from '@nestjs/common';
import { STOP_WORDS } from './stop-words';
import { ITokenizer } from './tokenizer.interface';

/**
 * Splits text into lowercase word tokens and removes stop words.
 */
@Injectable()
export class TokenizerService implements ITokenizer {
  /**
   * Normalizes text and returns content tokens suitable for comparison.
   */
  tokenize(text: string): string[] {
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

    return normalized;
  }
}
