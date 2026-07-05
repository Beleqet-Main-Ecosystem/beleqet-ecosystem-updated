import { ComparisonDocument } from '../types/plagiarism.types';
export declare class InternetSourceService {
    private readonly logger;
    loadFromUrls(urls: string[]): Promise<ComparisonDocument[]>;
    private fetchPageText;
    private stripHtml;
    private extractTitleFromUrl;
}
