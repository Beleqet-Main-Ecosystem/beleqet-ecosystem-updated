export declare function roundScore(score: number): number;
export declare function cosineSimilarity(a: number[], b: number[]): number;
export declare function termFrequency(tokens: string[]): Map<string, number>;
export declare function tfToVector(tf: Map<string, number>, vocabulary: string[]): number[];
