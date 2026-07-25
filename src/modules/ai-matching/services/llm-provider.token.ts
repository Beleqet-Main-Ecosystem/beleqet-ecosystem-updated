import type { PromptTemplate } from '../prompts/prompt-template.interface';
import type { LlmResponse } from '../interfaces/llm-response.interface';

/** Service-level contract for any LLM provider. */
export interface LlmProvider {
  evaluate(prompt: PromptTemplate): Promise<LlmResponse>;

  /**
   * Send a prompt to the LLM and return the raw response content as a string.
   * Unlike evaluate(), this does NOT validate structured fields — the caller
   * is responsible for parsing. Useful for generic completions like profile
   * insights where the output schema differs from candidate evaluation.
   */
  generate(prompt: PromptTemplate): Promise<string>;
}

/** NestJS DI token for the active LLM provider implementation. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
