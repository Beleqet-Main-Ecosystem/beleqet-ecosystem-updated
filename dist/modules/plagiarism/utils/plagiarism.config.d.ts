import { ConfigService } from '@nestjs/config';
import { SearchProvider, SimilarityWeights } from '../types/plagiarism.types';
export declare class PlagiarismConfig {
    private readonly config;
    readonly threshold: number;
    readonly enableWebSearch: boolean;
    readonly searchProvider: SearchProvider;
    readonly exaApiKey: string | undefined;
    readonly searxngUrl: string | undefined;
    readonly similarityWeights: SimilarityWeights;
    readonly maxPlatformDocuments: number;
    readonly maxWebResults: number;
    readonly verdictOriginalMax: number;
    readonly verdictSuspiciousMax: number;
    readonly earlyExitThreshold: number;
    readonly maxParagraphLength: number;
    readonly fetchTimeoutMs: number;
    constructor(config: ConfigService);
    resolveVerdict(similarity: number): 'original' | 'suspicious' | 'likely_plagiarized';
    private parseFloat;
    private parseInt;
    private parseBool;
    private parseSearchProvider;
    private parseWeights;
}
