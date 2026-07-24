import { Injectable } from '@nestjs/common';

/**
 * Normalizes raw input text before tokenization and chunking.
 * Handles unicode normalization, whitespace cleanup, and basic cleanup.
 */
@Injectable()
export class NormalizationService {
  /**
   * Applies full normalization pipeline to raw text.
   */
  normalize(text: string): string {
    return text
      .normalize('NFKC')
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
