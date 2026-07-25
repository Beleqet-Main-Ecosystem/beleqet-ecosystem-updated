/**
 * Status of a candidate as it progresses through the matching pipeline.
 */
export enum CandidateStatus {
  /** Not yet processed. */
  PENDING = 'PENDING',

  /** Found by vector search. */
  RETRIEVED = 'RETRIEVED',

  /** Passed GDPR sanitization. */
  SANITIZED = 'SANITIZED',

  /** Evaluated by the LLM. */
  EVALUATED = 'EVALUATED',

  /** Composite score computed. */
  SCORED = 'SCORED',

  /** Excluded due to consent or filter rules. */
  EXCLUDED = 'EXCLUDED',

  /** Error during processing. */
  FAILED = 'FAILED',
}
