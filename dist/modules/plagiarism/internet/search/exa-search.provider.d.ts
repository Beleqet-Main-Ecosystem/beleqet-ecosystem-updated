import { ISearchProvider } from './search-provider.interface';
import { PlagiarismConfig } from '../../utils/plagiarism.config';
export declare class ExaSearchProvider implements ISearchProvider {
    private readonly config;
    readonly name = "exa";
    private readonly logger;
    constructor(config: PlagiarismConfig);
    search(query: string, maxResults: number): Promise<{
        title: string;
        url: string;
        snippet?: string;
    }[]>;
}
