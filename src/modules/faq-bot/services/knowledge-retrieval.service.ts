import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { FaqKnowledgeEntry } from '@prisma/client';
import { resolveOpenAiClient } from './openai-config';

export interface RetrievedEntry extends FaqKnowledgeEntry {
  similarity?: number;
}

/**
 * Retrieves relevant FAQ knowledge entries using keyword lookup and vector similarity.
 * Embeddings are stored as JSON float arrays (portable vector store in PostgreSQL).
 */
@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.openai = resolveOpenAiClient(this.config);
  }

  /**
   * Fetch a published FAQ entry by its unique slug.
   * @param slug - FAQ entry slug
   */
  async findBySlug(slug: string): Promise<FaqKnowledgeEntry | null> {
    return this.prisma.faqKnowledgeEntry.findFirst({
      where: { slug, isPublished: true },
    });
  }

  /**
   * Find FAQ entries whose keywords overlap with the query tokens.
   * @param query - User question
   * @param limit - Maximum results
   */
  async findByKeywords(query: string, limit = 3): Promise<FaqKnowledgeEntry[]> {
    const tokens = query
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 2);

    if (tokens.length === 0) return [];

    const entries = await this.prisma.faqKnowledgeEntry.findMany({
      where: { isPublished: true },
    });

    const scored = entries
      .map((entry) => {
        const keywordMatches = entry.keywords.filter((kw) =>
          tokens.some((t) => kw.toLowerCase().includes(t) || t.includes(kw.toLowerCase())),
        ).length;
        const textMatches = tokens.filter(
          (t) =>
            entry.questionEn.toLowerCase().includes(t) ||
            entry.answerEn.toLowerCase().includes(t) ||
            (entry.questionAm?.toLowerCase().includes(t) ?? false),
        ).length;
        return { entry, score: keywordMatches * 2 + textMatches };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);

    return scored;
  }

  /**
   * Generate an embedding vector for semantic search.
   * @param text - Text to embed
   */
  async embedText(text: string): Promise<number[] | null> {
    if (!this.openai) return null;
    try {
      const model = this.config.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
      const response = await this.openai.embeddings.create({ model, input: text });
      return response.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(`Embedding failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   * @param a - First vector
   * @param b - Second vector
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Retrieve top-K FAQ entries by vector similarity (semantic search).
   * @param query - User question
   * @param limit - Maximum results
   */
  async findSimilar(query: string, limit = 5): Promise<RetrievedEntry[]> {
    const queryEmbedding = await this.embedText(query);
    if (!queryEmbedding) {
      return this.findByKeywords(query, limit);
    }

    const entries = await this.prisma.faqKnowledgeEntry.findMany({
      where: { isPublished: true },
    });

    const withEmbeddings = entries.filter(
      (entry) => entry.embedding !== null && entry.embedding !== undefined,
    );

    const scored: RetrievedEntry[] = withEmbeddings
      .map((entry) => {
        const stored = entry.embedding as number[] | null;
        if (!stored || !Array.isArray(stored)) return { ...entry, similarity: 0 };
        return {
          ...entry,
          similarity: this.cosineSimilarity(queryEmbedding, stored),
        };
      })
      .filter((e) => (e.similarity ?? 0) > 0.3)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);

    if (scored.length === 0) {
      return this.findByKeywords(query, limit);
    }

    return scored;
  }

  /**
   * Pick localized question/answer text for a knowledge entry.
   * @param entry - FAQ knowledge entry
   * @param locale - User locale (en | am)
   */
  localizeEntry(entry: FaqKnowledgeEntry, locale: string): { question: string; answer: string } {
    const isAm = locale === 'am';
    return {
      question: isAm && entry.questionAm ? entry.questionAm : entry.questionEn,
      answer: isAm && entry.answerAm ? entry.answerAm : entry.answerEn,
    };
  }
}
