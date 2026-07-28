import { PlagiarismConfig } from '../../utils/plagiarism.config';
import { ExaSearchProvider } from './exa-search.provider';
import { DuckDuckGoSearchProvider } from './duckduckgo-search.provider';
import { SearxngSearchProvider } from './searxng-search.provider';
export declare class WebSearchService {
    private readonly config;
    private readonly exa;
    private readonly duckduckgo;
    private readonly searxng;
    private readonly logger;
    constructor(config: PlagiarismConfig, exa: ExaSearchProvider, duckduckgo: DuckDuckGoSearchProvider, searxng: SearxngSearchProvider);
    search(query: string, maxResults?: number): Promise<{
        title: string;
        url: string;
        snippet?: string;
    }[]>;
    private resolveProvider;
}
