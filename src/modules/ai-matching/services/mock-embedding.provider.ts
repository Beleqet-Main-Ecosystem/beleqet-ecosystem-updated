import { Injectable } from '@nestjs/common';
import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { EmbeddingResult, EmbeddingRequest } from '../interfaces/embedding.interface';

/**
 * Mock EmbeddingProvider that returns random 1536-dimensional vectors.
 * Used for development/demo when no real embedding API is available.
 */
@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  private readonly dimensions = 1536;

  private generateRandomVector(): number[] {
    return Array.from({ length: this.dimensions }, () => (Math.random() - 0.5) * 2);
  }

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    return {
      embedding: {
        vector: this.generateRandomVector(),
        model: 'mock',
        dimensions: this.dimensions,
      },
      sourceText: text,
      tokenCount: text.length / 4,
      latencyMs: 0,
    };
  }

  async generateEmbeddingForJob(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const job = request.job;
    const skills = [...job.requiredSkills, ...job.preferredSkills].join(', ');
    const text = [job.title, job.description, skills].filter(Boolean).join('\n\n');
    return this.generateEmbedding(text);
  }
}
