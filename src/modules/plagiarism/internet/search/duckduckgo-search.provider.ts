import { Injectable, Logger } from '@nestjs/common';
import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';

/**
 * DuckDuckGo HTML lite search — free, no API key required.
 */
@Injectable()
export class DuckDuckGoSearchProvider implements ISearchProvider {
  readonly name = 'duckduckgo';
  private readonly logger = new Logger(DuckDuckGoSearchProvider.name);

  constructor(private readonly config: PlagiarismConfig) {}

  /**
   * Searches DuckDuckGo lite and parses result links from HTML.
   */
  async search(query: string, maxResults: number): Promise<{ title: string; url: string; snippet?: string }[]> {
    try {
      const body = new URLSearchParams({ q: query });
      const response = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Beleqet-PlagiarismScout/2.0',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseResults(html, maxResults);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`DuckDuckGo search failed: ${message}`);
      return [];
    }
  }

  /**
   * Extracts search result entries from DuckDuckGo lite HTML.
   */
  private parseResults(
    html: string,
    maxResults: number,
  ): { title: string; url: string; snippet?: string }[] {
    const results: { title: string; url: string; snippet?: string }[] = [];
    const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
      const rawUrl = match[1];
      const title = this.decodeHtml(match[2].trim());
      const url = this.resolveUrl(rawUrl);
      if (url.startsWith('http')) {
        results.push({ title, url });
      }
    }

    if (results.length === 0) {
      const fallbackRegex = /uddg=([^&"]+)/g;
      const titleRegex = /<td[^>]*><b>([^<]+)<\/b>/g;
      const urls: string[] = [];
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = fallbackRegex.exec(html)) !== null && urls.length < maxResults) {
        try {
          urls.push(decodeURIComponent(urlMatch[1]));
        } catch {
          /* skip malformed */
        }
      }
      const titles: string[] = [];
      let titleMatch: RegExpExecArray | null;
      while ((titleMatch = titleRegex.exec(html)) !== null && titles.length < maxResults) {
        titles.push(this.decodeHtml(titleMatch[1].trim()));
      }
      for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
        results.push({ title: titles[i] ?? urls[i], url: urls[i] });
      }
    }

    return results;
  }

  private resolveUrl(raw: string): string {
    if (raw.startsWith('http')) return raw;
    if (raw.includes('uddg=')) {
      const match = raw.match(/uddg=([^&]+)/);
      if (match) {
        try {
          return decodeURIComponent(match[1]);
        } catch {
          return raw;
        }
      }
    }
    return raw;
  }

  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
