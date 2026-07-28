import { TokenizerService } from '../tokenizer/tokenizer.service';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';
export declare class JaccardService implements ISimilarityAlgorithm {
    private readonly tokenizer;
    readonly name: "jaccard";
    constructor(tokenizer: TokenizerService);
    compare(textA: string, textB: string): SimilarityAlgorithmResult;
}
