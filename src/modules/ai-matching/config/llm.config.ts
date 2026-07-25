/**
 * Configuration for LLM evaluation behavior.
 * Provider-agnostic — resolved at the provider layer.
 */
export interface LlmConfig {
  /** The LLM model identifier (provider-specific). */
  readonly model: string;

  /** Sampling temperature for LLM calls (0 = deterministic). */
  readonly temperature: number;

  /** Maximum tokens in the LLM completion response. */
  readonly maxTokens: number;

  /** LLM API call timeout in milliseconds. */
  readonly timeoutMs: number;

  /** Maximum number of top candidates sent for LLM evaluation. */
  readonly maxCandidatesForEvaluation: number;
}

export const defaultLlmConfig: LlmConfig = {
  model: 'default',
  temperature: 0,
  maxTokens: 1000,
  timeoutMs: 10000,
  maxCandidatesForEvaluation: 20,
} as const;
