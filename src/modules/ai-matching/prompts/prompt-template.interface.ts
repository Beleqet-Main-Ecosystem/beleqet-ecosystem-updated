/**
 * Contract for a prompt template consumed by a future PromptService.
 *
 * Each template bundles a system instruction and a user-facing prompt,
 * plus an explicit list of required {{variable}} placeholders so the
 * service can validate completeness before sending to the LLM.
 */
export interface PromptTemplate {
  /** System-level instructions defining the LLM's role, output format, and guardrails. */
  readonly systemPrompt: string;

  /** User-facing prompt containing {{variable}} placeholders to be interpolated. */
  readonly userPrompt: string;

  /** All {{variable}} names expected in userPrompt, for pre-call validation. */
  readonly requiredVariables: readonly string[];
}
