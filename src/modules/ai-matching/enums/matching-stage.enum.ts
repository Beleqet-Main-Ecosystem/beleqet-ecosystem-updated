/**
 * Stages of the AI matching pipeline.
 * Used to track progress within a matching session.
 */
export enum MatchingStage {
  EMBEDDING = 'EMBEDDING',
  VECTOR_SEARCH = 'VECTOR_SEARCH',
  SANITIZATION = 'SANITIZATION',
  LLM_EVALUATION = 'LLM_EVALUATION',
  SCORING = 'SCORING',
  RANKING = 'RANKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
