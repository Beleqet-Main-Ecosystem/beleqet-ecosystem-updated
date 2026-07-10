import { Injectable } from '@nestjs/common';
import { TextChunk } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';

/** Regex to split text into sentences. */
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * Splits documents into paragraphs and sentences for granular comparison.
 * Large paragraphs are further split into sentences.
 */
@Injectable()
export class ChunkerService {
  constructor(private readonly config: PlagiarismConfig) {}

  /**
   * Splits normalized text into comparable chunks.
   */
  chunk(text: string): TextChunk[] {
    const paragraphs = text
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: TextChunk[] = [];
    let index = 0;

    for (const paragraph of paragraphs) {
      if (paragraph.length <= this.config.maxParagraphLength) {
        chunks.push({ index: index++, text: paragraph, type: 'paragraph' });
        continue;
      }

      const sentences = paragraph
        .split(SENTENCE_SPLIT)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);

      for (const sentence of sentences) {
        chunks.push({ index: index++, text: sentence, type: 'sentence' });
      }
    }

    if (chunks.length === 0 && text.trim().length > 0) {
      chunks.push({ index: 0, text: text.trim(), type: 'paragraph' });
    }

    return chunks;
  }
}
