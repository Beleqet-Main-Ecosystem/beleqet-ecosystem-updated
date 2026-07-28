import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';
export declare class SearxngSearchProvider implements ISearchProvider {
    private readonly config;
    readonly name = "searxng";
    private readonly logger;
    constructor(config: PlagiarismConfig);
    search(query: string, maxResults: number): Promise<{
        title: string;
        url: string;
        snippet?: string;
    }[]>;
}
