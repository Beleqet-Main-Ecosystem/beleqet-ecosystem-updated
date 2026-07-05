export type MatchSourceType = 'platform' | 'internet';
export type QualityVerdict = 'original' | 'suspicious' | 'likely_plagiarized';
export interface ComparisonDocument {
    id: string;
    entityType: string;
    title: string;
    content: string;
    sourceType: MatchSourceType;
    sourceUrl?: string;
}
export interface PlagiarismMatch {
    sourceType: MatchSourceType;
    entityType: string;
    entityId: string;
    title: string;
    similarity: number;
    matchedTokens: string[];
    sourceUrl?: string;
}
export interface PlagiarismCheckResult {
    checkId: string;
    inputLength: number;
    maxSimilarity: number;
    averageSimilarity: number;
    matchCount: number;
    verdict: QualityVerdict;
    matches: PlagiarismMatch[];
    checkedAt: string;
}
