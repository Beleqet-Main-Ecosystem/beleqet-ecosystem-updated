/**
 * Rounds a score to 4 decimal places for consistent API output.
 */
export function roundScore(score: number): number {
  return Math.round(score * 10_000) / 10_000;
}

/**
 * Computes cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Builds a term-frequency map from a token list.
 */
export function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

/**
 * Converts a TF map to a dense vector using a shared vocabulary ordering.
 */
export function tfToVector(tf: Map<string, number>, vocabulary: string[]): number[] {
  return vocabulary.map((term) => tf.get(term) ?? 0);
}
