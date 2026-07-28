export type MatchSourceType = 'platform' | 'internet';
export type QualityVerdict = 'original' | 'suspicious' | 'likely_plagiarized';
export type SearchProvider = 'exa' | 'duckduckgo' | 'searxng';
export interface AlgorithmScores {
    jaccard: number;
    cosine: number;
    ngram: number;
    semantic: number;
}
export interface SimilarityWeights {
    jaccard: number;
    cosine: number;
    ngram: number;
    semantic: number;
}
export interface TextChunk {
    index: number;
    text: string;
    type: 'paragraph' | 'sentence';
}
export interface MatchedChunk {
    inputChunkIndex: number;
    sourceChunkIndex: number;
    inputText: string;
    sourceText: string;
    similarity: number;
    algorithmScores: AlgorithmScores;
}
export interface MatchedPhrase {
    phrase: string;
    inputOccurrences: number;
    sourceOccurrences: number;
}
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
    algorithmScores: AlgorithmScores;
    matchedChunks: MatchedChunk[];
    matchedPhrases: MatchedPhrase[];
    matchedTokens: string[];
    sourceUrl?: string;
}
export interface QualityAssessment {
    originality: number;
    professionalLanguage: number;
    readability: number;
    contentCompleteness: number;
    duplicateSentences: number;
    grammarWarnings: string[];
}
export interface PlagiarismCheckResult {
    checkId: string;
    inputLength: number;
    overallSimilarity: number;
    maxSimilarity: number;
    averageSimilarity: number;
    matchCount: number;
    verdict: QualityVerdict;
    qualityScore: number;
    qualityAssessment: QualityAssessment;
    sourcesChecked: number;
    internetSourcesChecked: number;
    matches: PlagiarismMatch[];
    checkedAt: string;
}
export interface ComparisonResult {
    similarity: number;
    algorithmScores: AlgorithmScores;
    matchedTokens: string[];
    matchedPhrases: MatchedPhrase[];
}
export interface SearchResult {
    title: string;
    url: string;
    snippet?: string;
}
