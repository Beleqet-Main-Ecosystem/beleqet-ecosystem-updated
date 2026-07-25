import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import type { EmbeddingResult, EmbeddingRequest } from '../interfaces/embedding.interface';

/**
 * Concrete EmbeddingProvider that communicates with the OpenAI embeddings API.
 *
 * Injects ConfigService to read OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL.
 * All OpenAI SDK usage is isolated within this class.
 */
@Injectable()
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OpenAiEmbeddingProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const baseURL = config.get<string>('OPENAI_BASE_URL') ?? undefined;
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = config.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  }

  /**
   * Generate an embedding vector from a raw text string.
   * Calls the OpenAI embeddings API and maps the response to EmbeddingResult.
   *
   * @param text - The source text to embed.
   * @returns EmbeddingResult with vector, token count, and latency.
   * @throws InternalServerErrorException when the API call fails.
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const start = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      const latencyMs = Date.now() - start;
      const result = response.data[0];

      return {
        embedding: {
          vector: result.embedding,
          model: this.model,
          dimensions: result.embedding.length,
        },
        sourceText: text,
        tokenCount: response.usage?.total_tokens ?? 0,
        latencyMs,
      };
    } catch (error) {
      this.logger.error(
        'OpenAI embedding API call failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Embedding generation failed');
    }
  }

  /**
   * Generate an embedding for a full job posting.
   * Concatenates title, description, and skills into a single text before embedding.
   *
   * @param request - Embedding request containing the job and optional model preference.
   * @returns The embedding result.
   */
  async generateEmbeddingForJob(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const job = request.job;
    const skills = [...job.requiredSkills, ...job.preferredSkills].join(', ');

    const text = [job.title, job.description, skills].filter(Boolean).join('\n\n');

    return this.generateEmbedding(text);
  }
}
