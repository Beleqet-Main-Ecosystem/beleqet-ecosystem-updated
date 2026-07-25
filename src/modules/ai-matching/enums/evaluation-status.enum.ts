/**
 * Status of an individual LLM evaluation for a single candidate.
 */
export enum EvaluationStatus {
  /** Waiting to be evaluated. */
  QUEUED = 'QUEUED',

  /** Evaluation is in progress. */
  IN_PROGRESS = 'IN_PROGRESS',

  /** Evaluation completed successfully. */
  COMPLETED = 'COMPLETED',

  /** Evaluation failed (error or timeout). */
  FAILED = 'FAILED',

  /** Skipped due to score bypass thresholds. */
  SKIPPED = 'SKIPPED',
}
