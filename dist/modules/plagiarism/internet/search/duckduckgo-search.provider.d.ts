import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';
export declare class DuckDuckGoSearchProvider implements ISearchProvider {
    private readonly config;
    readonly name = "duckduckgo";
    private readonly logger;
    constructor(config: PlagiarismConfig);
    search(query: string, maxResults: number): Promise<{
        title: string;
        url: string;
        snippet?: string;
    }[]>;
    private parseResults;
    private resolveUrl;
    private decodeHtml;
}
