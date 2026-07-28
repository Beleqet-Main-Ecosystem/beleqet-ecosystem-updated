export interface SimilarityAlgorithmResult {
    score: number;
    matchedTokens?: string[];
    matchedPhrases?: {
        phrase: string;
        inputOccurrences: number;
        sourceOccurrences: number;
    }[];
}
export interface ISimilarityAlgorithm {
    readonly name: keyof import('../types/plagiarism.types').AlgorithmScores;
    compare(textA: string, textB: string): SimilarityAlgorithmResult | Promise<SimilarityAlgorithmResult>;
}
