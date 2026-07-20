import { Injectable, Logger } from '@nestjs/common';
import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';

/**
 * SearXNG meta-search provider — requires SEARXNG_URL environment variable.
 */
@Injectable()
export class SearxngSearchProvider implements ISearchProvider {
  readonly name = 'searxng';
  private readonly logger = new Logger(SearxngSearchProvider.name);

  constructor(private readonly config: PlagiarismConfig) {}

  /**
   * Searches via a self-hosted SearXNG instance.
   */
  async search(query: string, maxResults: number): Promise<{ title: string; url: string; snippet?: string }[]> {
    if (!this.config.searxngUrl) {
      this.logger.warn('SEARXNG_URL not configured — skipping SearXNG search');
      return [];
    }

    const baseUrl = this.config.searxngUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Beleqet-PlagiarismScout/2.0' },
      signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`SearXNG HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: { title: string; url: string; content?: string }[];
    };

    return (data.results ?? []).slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
}
