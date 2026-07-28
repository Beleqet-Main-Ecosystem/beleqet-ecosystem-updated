import { ComparisonDocument } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { KeywordExtractorService } from './keyword-extractor.service';
import { WebSearchService } from './search/web-search.service';
export declare class InternetSourceService {
    private readonly config;
    private readonly keywordExtractor;
    private readonly webSearch;
    private readonly logger;
    constructor(config: PlagiarismConfig, keywordExtractor: KeywordExtractorService, webSearch: WebSearchService);
    loadFromSearch(inputText: string): Promise<ComparisonDocument[]>;
    loadFromUrls(urls: string[], searchMeta?: {
        title: string;
        url: string;
        snippet?: string;
    }[]): Promise<ComparisonDocument[]>;
    private fetchPageText;
    private fetchHtmlByIp;
    private stripHtml;
    private validateFetchUrl;
    private isPrivateIp;
    private extractTitleFromUrl;
}
