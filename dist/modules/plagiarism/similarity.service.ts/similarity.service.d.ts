import { JaccardStrategy } from './jaccard.strategy';
import { SimilarityResult } from './similarity.interface';
export declare class SimilarityService {
    private readonly jaccardStrategy;
    constructor(jaccardStrategy: JaccardStrategy);
    compare(textA: string, textB: string): SimilarityResult;
}
