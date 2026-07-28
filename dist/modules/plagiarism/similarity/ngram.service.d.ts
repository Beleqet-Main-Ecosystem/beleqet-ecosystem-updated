import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';
export declare class NgramService implements ISimilarityAlgorithm {
    readonly name: "ngram";
    compare(textA: string, textB: string): SimilarityAlgorithmResult;
    private normalizeForNgrams;
    private buildNgrams;
    private jaccardNgrams;
}
