import type { EvaluationDecision } from './evaluation.interface';

/**
 * A raw structured response from the LLM evaluation.
 * Contains the full output before any post-processing or scoring.
 */
export interface LlmResponse {
  /** The match decision returned by the LLM (typed, not a free string). */
  readonly decision: EvaluationDecision;

  /** Confidence score as declared by the LLM (0–1). */
  readonly confidence: number;

  /** Free-text reasoning from the LLM. */
  readonly reasoning: string;

  /** Skills the LLM identified as gaps. */
  readonly skillGaps: readonly string[];

  /** Skills the LLM identified as strengths. */
  readonly strengths: readonly string[];

  /** The raw text output from the LLM (for debugging). */
  readonly rawOutput: string;

  /** Token usage for the LLM call. */
  readonly tokenUsage: TokenUsage;

  /** Latency of the LLM call in milliseconds. */
  readonly latencyMs: number;
}

/**
 * Token consumption for an LLM API call.
 */
export interface TokenUsage {
  /** Tokens used in the prompt. */
  readonly prompt: number;

  /** Tokens used in the completion. */
  readonly completion: number;

  /** Total tokens consumed. */
  readonly total: number;
}
