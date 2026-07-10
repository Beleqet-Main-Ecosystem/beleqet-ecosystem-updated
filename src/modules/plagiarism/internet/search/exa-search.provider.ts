import { Injectable, Logger } from '@nestjs/common';
import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';

/**
 * Exa Search API provider.
 * Requires EXA_API_KEY environment variable.
 */
@Injectable()
export class ExaSearchProvider implements ISearchProvider {
  readonly name = 'exa';

  private readonly logger = new Logger(ExaSearchProvider.name);

  constructor(private readonly config: PlagiarismConfig) {}

  /**
   * Searches the web using the Exa Search API.
   */
  async search(
    query: string,
    maxResults: number,
  ): Promise<{ title: string; url: string; snippet?: string }[]> {
    if (!this.config.exaApiKey) {
      this.logger.warn('EXA_API_KEY not configured — skipping Exa search');
      return [];
    }

    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': this.config.exaApiKey,
      },
      body: JSON.stringify({
        query,
        numResults: maxResults,
        contents: {
          text: true,
        },
      }),
      signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Exa search HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      results?: {
        title: string;
        url: string;
        text?: string;
      }[];
    };
    console.log('Exa search results:', data.results);
    return (data.results ?? [])
      .slice(0, maxResults)
      .map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.text,
      }));
  }
}