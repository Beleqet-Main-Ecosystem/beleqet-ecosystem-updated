import type { LlmCandidateProfile } from './llm-candidate-profile.interface';
import type { JobSummary } from './job.interface';

/**
 * A request to evaluate a single candidate against a job.
 */
export interface EvaluationRequest {
  /** The job the candidate is being evaluated for. */
  readonly job: JobSummary;

  /** The sanitized candidate profile (PII-free, LLM-safe). */
  readonly candidate: LlmCandidateProfile;

  /** Locale for prompt selection (e.g., "en", "am"). */
  readonly locale: string;
}

/**
 * The result of evaluating a single candidate.
 */
export interface EvaluationResult {
  /** Session-scoped token identifying the candidate. */
  readonly candidateToken: string;

  /** The match decision from the LLM. */
  readonly decision: EvaluationDecision;

  /** LLM confidence score (0–1). */
  readonly confidence: number;

  /** Free-text reasoning from the LLM. */
  readonly reasoning: string;

  /** Skills the freelancer is missing for this job. */
  readonly skillGaps: readonly string[];

  /** Skills where the freelancer exceeds expectations. */
  readonly strengths: readonly string[];

  /** When the evaluation was performed. */
  readonly evaluatedAt: Date;
}

/**
 * The match decision categories returned by the LLM.
 */
export type EvaluationDecision = 'STRONG_MATCH' | 'POTENTIAL_MATCH' | 'WEAK_MATCH' | 'NOT_A_MATCH';

/**
 * Aggregate result for a batch of candidate evaluations.
 */
export interface EvaluationBatchResult {
  /** Per-candidate evaluation results. */
  readonly results: readonly EvaluationResult[];

  /** Candidates that failed evaluation (with error details). */
  readonly failures: readonly EvaluationFailure[];

  /** Total latency across all evaluations in milliseconds. */
  readonly totalLatencyMs: number;

  /** Total prompt tokens consumed across all evaluations. */
  readonly totalPromptTokens: number;

  /** Total completion tokens consumed across all evaluations. */
  readonly totalCompletionTokens: number;

  /** Total tokens consumed across all evaluations. */
  readonly totalTokens: number;
}

/**
 * A candidate evaluation that failed.
 */
export interface EvaluationFailure {
  /** Session-scoped token identifying the candidate. */
  readonly candidateToken: string;

  /** Error message describing the failure. */
  readonly error: string;
}
