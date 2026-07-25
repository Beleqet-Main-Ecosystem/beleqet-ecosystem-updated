/**
 * Branded type for an embedding vector.
 * A read-only array of numbers representing a dense vector embedding.
 */
export type EmbeddingVector = readonly number[] & { readonly __brand: 'EmbeddingVector' };
