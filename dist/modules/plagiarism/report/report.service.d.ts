import { AlgorithmScores, ComparisonDocument, MatchedChunk, MatchedPhrase, PlagiarismCheckResult, PlagiarismMatch, TextChunk } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { QualityAnalyzerService } from './quality-analyzer.service';
export interface ReportInput {
    inputText: string;
    inputChunks: TextChunk[];
    matches: PlagiarismMatch[];
    platformDocCount: number;
    internetDocCount: number;
}
export declare class ReportService {
    private readonly config;
    private readonly qualityAnalyzer;
    constructor(config: PlagiarismConfig, qualityAnalyzer: QualityAnalyzerService);
    buildReport(input: ReportInput): PlagiarismCheckResult;
    buildMatch(doc: ComparisonDocument, documentSimilarity: number, algorithmScores: AlgorithmScores, matchedChunks: MatchedChunk[], matchedPhrases: MatchedPhrase[], matchedTokens: string[]): PlagiarismMatch;
}
