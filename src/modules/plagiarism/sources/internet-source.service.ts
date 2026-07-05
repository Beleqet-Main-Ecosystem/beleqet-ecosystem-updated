import { Injectable, Logger } from '@nestjs/common';
import { ComparisonDocument } from '../types/plagiarism.types';

/** Timeout for fetching external web pages (milliseconds). */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Fetches and extracts text from internet URLs for plagiarism comparison.
 */
@Injectable()
export class InternetSourceService {
  private readonly logger = new Logger(InternetSourceService.name);

  /**
   * Loads text content from the provided public URLs.
   */
  async loadFromUrls(urls: string[]): Promise<ComparisonDocument[]> {
    const documents: ComparisonDocument[] = [];

    for (const url of urls) {
      try {
        const content = await this.fetchPageText(url);
        if (content.length < 50) continue;

        documents.push({
          id: url,
          entityType: 'WebPage',
          title: this.extractTitleFromUrl(url),
          content,
          sourceType: 'internet',
          sourceUrl: url,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to fetch URL ${url}: ${message}`);
      }
    }

    return documents;
  }

  /**
   * Downloads a page and strips HTML tags to plain text.
   */
  private async fetchPageText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Beleqet-PlagiarismScout/1.0' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.stripHtml(html);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Removes scripts, styles, and HTML tags from raw page content.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Builds a readable label from a URL path.
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname + parsed.pathname;
    } catch {
      return url;
    }
  }
}
