import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ComparisonDocument } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { KeywordExtractorService } from './keyword-extractor.service';
import { WebSearchService } from './search/web-search.service';

/**
 * Automatically searches the web, downloads pages, and extracts visible text
 * for plagiarism comparison. Also supports legacy URL-based loading.
 */
@Injectable()
export class InternetSourceService {
  private readonly logger = new Logger(InternetSourceService.name);

  constructor(
    private readonly config: PlagiarismConfig,
    private readonly keywordExtractor: KeywordExtractorService,
    private readonly webSearch: WebSearchService,
  ) {}

  /**
   * Discovers and loads internet documents via automatic web search.
   */
  async loadFromSearch(inputText: string): Promise<ComparisonDocument[]> {
    if (!this.config.enableWebSearch) {
      this.logger.debug('Web search disabled — skipping internet sources');
      return [];
    }
 
    const query = this.keywordExtractor.extractQuery(inputText);
    this.logger.debug(`Web search query: "${query}"`);
 
    const searchResults = await this.webSearch.search(query);
    this.logger.debug(`Web search returned ${searchResults.length} results`);
    const urls = searchResults.map((r) => r.url);
 
    return this.loadFromUrls(urls, searchResults);
  }

  /**
   * Loads text content from explicit URLs (legacy support).
   */
  async loadFromUrls(
    urls: string[],
    searchMeta?: { title: string; url: string; snippet?: string }[],
  ): Promise<ComparisonDocument[]> {
    const metaByUrl = new Map((searchMeta ?? []).map((r) => [r.url, r]));
    const uniqueUrls = [...new Set(urls)].slice(0, this.config.maxWebResults);

    const documents: ComparisonDocument[] = [];

    await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const content = await this.fetchPageText(url);
          if (content.length < 50) return;

          const meta = metaByUrl.get(url);
          documents.push({
            id: url,
            entityType: 'WebPage',
            title: meta?.title ?? this.extractTitleFromUrl(url),
            content,
            sourceType: 'internet',
            sourceUrl: url,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Failed to fetch URL ${url}: ${message}`);
        }
      }),
    );

    return documents;
  }

  /**
   * Downloads a page and strips HTML tags to plain text.
   */
  private async fetchPageText(url: string): Promise<string> {
    await this.validateFetchUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);
 
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Beleqet-PlagiarismScout/2.0' },
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
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#?\w+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
 
  private async validateFetchUrl(url: string): Promise<void> {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only http:// and https:// URLs are allowed for internet sources');
    }
 
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
      throw new Error('URL points to a local or private host');
    }
 
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) {
      throw new Error('Unable to resolve URL hostname');
    }
 
    for (const address of addresses) {
      if (this.isPrivateIp(address.address)) {
        throw new Error('URL resolves to a private or local IP address');
      }
    }
  }
 
  private isPrivateIp(ip: string): boolean {
    if (ip === '::1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
 
    const version = isIP(ip);
    if (version === 4) {
      const [octet1, octet2] = ip.split('.').map(Number);
      return (
        octet1 === 10 ||
        (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
        (octet1 === 192 && octet2 === 168) ||
        octet1 === 127
      );
    }
 
    if (version === 6) {
      return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip === '::1';
    }
 
    return false;
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
