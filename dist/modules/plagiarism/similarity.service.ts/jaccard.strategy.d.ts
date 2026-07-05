import { TokenizerService } from '../tokenizer/tokenizer.service';
import { ISimilarityStrategy, SimilarityResult } from './similarity.interface';
export declare class JaccardStrategy implements ISimilarityStrategy {
    private readonly tokenizer;
    constructor(tokenizer: TokenizerService);
    compare(textA: string, textB: string): SimilarityResult;
}
