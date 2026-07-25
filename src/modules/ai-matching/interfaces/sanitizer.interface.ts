import type { Candidate } from './candidate.interface';
import type { LlmCandidateProfile } from './llm-candidate-profile.interface';

/**
 * Contract for sanitizing freelancer candidate profiles before
 * they are sent to an external LLM provider.
 *
 * Implementations strip PII, truncate history, replace internal IDs
 * with session-scoped tokens, and enforce consent flags.
 * Returns an LlmCandidateProfile — the only object allowed to cross
 * the system boundary to external AI providers.
 */
export interface Sanitizer {
  /**
   * Sanitize a single candidate profile.
   *
   * @param candidate - The raw candidate data from the database.
   * @returns An LLM-safe candidate profile with all PII removed.
   */
  sanitize(candidate: Candidate): Promise<LlmCandidateProfile>;

  /**
   * Sanitize a batch of candidates in a single operation.
   * Implementations may parallelise sanitization internally.
   *
   * @param candidates - The raw candidate list.
   * @returns LLM-safe candidate profiles in the same order.
   */
  sanitizeBatch(candidates: readonly Candidate[]): Promise<readonly LlmCandidateProfile[]>;
}
