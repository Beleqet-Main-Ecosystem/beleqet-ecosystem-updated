import { Inject, Injectable } from '@nestjs/common';
import type { VectorProvider } from '../interfaces/vector-provider.interface';
import type {
  VectorSearchFilters,
  VectorSearchResult,
} from '../interfaces/vector-search.interface';
import type { VectorSearchConfig } from '../config/vector-search.config';
import { VECTOR_PROVIDER } from './vector-provider.token';

@Injectable()
export class VectorSearchService {
  constructor(
    @Inject(VECTOR_PROVIDER) private readonly provider: VectorProvider,
    @Inject('VECTOR_SEARCH_CONFIG') private readonly config: VectorSearchConfig,
  ) {}

  /**
   * Search for candidates similar to the given embedding vector.
   * Uses topK and minimumSimilarityScore from configuration as defaults.
   *
   * @param embedding - The query embedding vector.
   * @param filters   - Optional pre-filters (hourly rate, skills, excluded IDs).
   * @returns Ranked vector search results.
   */
  async searchCandidates(
    embedding: readonly number[],
    filters?: VectorSearchFilters,
  ): Promise<VectorSearchResult> {
    const query = {
      embedding,
      topK: this.config.topK,
      minScore: this.config.minimumSimilarityScore,
      filters,
    } as const;

    return this.provider.search(query);
  }
}
