/**
 * Origin of a score value in the matching pipeline.
 */
export enum ScoreSource {
  /** Cosine similarity from vector search. */
  VECTOR_SEARCH = 'VECTOR_SEARCH',

  /** Confidence score from LLM evaluation. */
  LLM_EVALUATION = 'LLM_EVALUATION',

  /** Weighted combination of vector and LLM scores. */
  COMPOSITE = 'COMPOSITE',
}
