import { Injectable, Logger } from '@nestjs/common';
import { SearchProvider } from '../../types/plagiarism.types';
import { PlagiarismConfig } from '../../utils/plagiarism.config';
import { ExaSearchProvider } from './exa-search.provider';
import { DuckDuckGoSearchProvider } from './duckduckgo-search.provider';
import { SearxngSearchProvider } from './searxng-search.provider';
import { ISearchProvider } from './search-provider.interface';

/**
 * Selects and delegates to the configured web search provider.
 * Falls back to DuckDuckGo when the primary provider fails or is unavailable.
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(
    private readonly config: PlagiarismConfig,
    private readonly exa: ExaSearchProvider,
    private readonly duckduckgo: DuckDuckGoSearchProvider,
    private readonly searxng: SearxngSearchProvider,
  ) {}

  /**
   * Executes a web search using the configured provider with fallback.
   */
  async search(query: string, maxResults?: number): Promise<{ title: string; url: string; snippet?: string }[]> {
    const limit = maxResults ?? this.config.maxWebResults;
    const provider = this.resolveProvider();

    try {
      const results = await provider.search(query, limit);
      if (results.length > 0) return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`${provider.name} search failed: ${message}`);
    }

    if (provider.name !== 'duckduckgo') {
      this.logger.debug('Falling back to DuckDuckGo search');
      return this.duckduckgo.search(query, limit);
    }

    return [];
  }

  private resolveProvider(): ISearchProvider {
    const map: Record<SearchProvider, ISearchProvider> = {
      exa: this.exa,
      duckduckgo: this.duckduckgo,
      searxng: this.searxng,
    };
    return map[this.config.searchProvider] ?? this.duckduckgo;
  }
}
