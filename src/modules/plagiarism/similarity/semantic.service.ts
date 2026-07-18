import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';

/** Local embedding model — free, no API cost. */
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type FeatureExtractionPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: Float32Array | number[] }>;

/**
 * Semantic similarity using local sentence-transformers via @xenova/transformers.
 * Detects paraphrased and meaning-level similarity without paid APIs.
 */
@Injectable()
export class SemanticService implements ISimilarityAlgorithm, OnModuleInit {
  readonly name = 'semantic' as const;

  private readonly logger = new Logger(SemanticService.name);
  private extractor: FeatureExtractionPipeline | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly embeddingCache = new Map<string, number[]>();

  /**
   * Pre-loads the embedding model on module startup (non-blocking).
   */
  onModuleInit(): void {
    void this.ensureModel().catch((err) => {
      this.logger.warn(`Semantic model preload skipped: ${err instanceof Error ? err.message : err}`);
    });
  }

  /**
   * Computes cosine similarity between sentence embeddings.
   */
  async compare(textA: string, textB: string): Promise<SimilarityAlgorithmResult> {
    try {
      await this.ensureModel();
      if (!this.extractor) {
        return { score: 0 };
      }

      const [embeddingA, embeddingB] = await Promise.all([
        this.getEmbedding(textA),
        this.getEmbedding(textB),
      ]);

      const score = this.cosine(embeddingA, embeddingB);
      return { score };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Semantic comparison failed: ${message}`);
      return { score: 0 };
    }
  }

  /**
   * Lazily initializes the transformer pipeline.
   */
  private async ensureModel(): Promise<void> {
    if (this.extractor) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = (await pipeline('feature-extraction', MODEL_ID)) as FeatureExtractionPipeline;
      this.logger.log(`Semantic model loaded: ${MODEL_ID}`);
    })();

    return this.initPromise;
  }

  /**
   * Returns a normalized embedding vector for the given text.
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) return cached;

    const output = await this.extractor!(text, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    this.embeddingCache.set(text, embedding);
    return embedding;
  }

  /**
   * Cosine similarity between two embedding vectors.
   */
  private cosine(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }
}
