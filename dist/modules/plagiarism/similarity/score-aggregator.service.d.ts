import { AlgorithmScores, ComparisonResult, MatchedPhrase, SimilarityWeights } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { CosineService } from './cosine.service';
import { JaccardService } from './jaccard.service';
import { NgramService } from './ngram.service';
import { SemanticService } from './semantic.service';
export declare class ScoreAggregatorService {
    private readonly config;
    constructor(config: PlagiarismConfig);
    aggregate(scores: AlgorithmScores, weights?: SimilarityWeights): number;
    buildResult(scores: AlgorithmScores, matchedTokens: string[], matchedPhrases: MatchedPhrase[]): ComparisonResult;
}
export declare class SimilarityEngineService {
    private readonly jaccard;
    private readonly cosine;
    private readonly ngram;
    private readonly semantic;
    private readonly aggregator;
    private readonly config;
    constructor(jaccard: JaccardService, cosine: CosineService, ngram: NgramService, semantic: SemanticService, aggregator: ScoreAggregatorService, config: PlagiarismConfig);
    compare(textA: string, textB: string, skipSemantic?: boolean): Promise<ComparisonResult>;
}
