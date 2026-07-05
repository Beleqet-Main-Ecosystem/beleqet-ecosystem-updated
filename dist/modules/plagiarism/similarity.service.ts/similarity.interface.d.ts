export interface SimilarityResult {
    score: number;
    matchedTokens: string[];
}
export interface ISimilarityStrategy {
    compare(textA: string, textB: string): SimilarityResult;
}
