import { Inject, Injectable } from '@nestjs/common';
import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { EmbeddingResult, EmbeddingRequest } from '../interfaces/embedding.interface';
import type { Job } from '../interfaces/job.interface';
import type { EmbeddingConfig } from '../config/embedding.config';
import { normalizeText } from '../utils/text-normalizer.util';
import { EMBEDDING_PROVIDER } from './embedding-provider.token';

@Injectable()
export class EmbeddingService {
  constructor(
    @Inject(EMBEDDING_PROVIDER) private readonly provider: EmbeddingProvider,
    @Inject('EMBEDDING_CONFIG') private readonly config: EmbeddingConfig,
  ) {}

  /**
   * Generate an embedding for a full job posting.
   * Normalizes the job description before delegating to the provider.
   *
   * @param job - The job posting to embed.
   * @returns The embedding result with vector, token count, and latency.
   */
  async embedJob(job: Job): Promise<EmbeddingResult> {
    const request: EmbeddingRequest = {
      job: {
        ...job,
        description: normalizeText(job.description),
      },
    };
    return this.provider.generateEmbeddingForJob(request);
  }

  /**
   * Generate an embedding for an arbitrary text string.
   * Normalizes input and truncates if it exceeds the configured maxInputLength.
   *
   * @param text - The source text to embed.
   * @returns The embedding result.
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    const normalized = normalizeText(text);
    const truncated = this.truncate(normalized);
    return this.provider.generateEmbedding(truncated);
  }

  private truncate(text: string): string {
    if (text.length <= this.config.maxInputLength) return text;
    return text.slice(0, this.config.maxInputLength);
  }
}
