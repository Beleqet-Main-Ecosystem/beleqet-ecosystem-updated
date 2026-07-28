import { TokenizerService } from '../tokenizer/tokenizer.service';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';
export declare class CosineService implements ISimilarityAlgorithm {
    private readonly tokenizer;
    readonly name: "cosine";
    constructor(tokenizer: TokenizerService);
    compare(textA: string, textB: string): SimilarityAlgorithmResult;
    private computeIdf;
}
