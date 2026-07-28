import { OnModuleInit } from '@nestjs/common';
import { ISimilarityAlgorithm, SimilarityAlgorithmResult } from './similarity.interface';
export declare class SemanticService implements ISimilarityAlgorithm, OnModuleInit {
    readonly name: "semantic";
    private readonly logger;
    private extractor;
    private initPromise;
    private readonly embeddingCache;
    onModuleInit(): void;
    compare(textA: string, textB: string): Promise<SimilarityAlgorithmResult>;
    private ensureModel;
    private getEmbedding;
    private cosine;
}
