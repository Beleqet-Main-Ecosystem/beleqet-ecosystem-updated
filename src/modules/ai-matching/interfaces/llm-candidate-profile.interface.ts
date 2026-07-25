/**
 * The ONLY candidate object allowed to leave the system and be sent
 * to external AI providers (LLMs).
 *
 * Contains no PII — no freelancerId, email, phone, name, or address.
 * Internal identifiers are replaced with session-scoped opaque tokens.
 */
export interface LlmCandidateProfile {
  /** Session-scoped opaque token replacing the real freelancer ID. */
  readonly sessionToken: string;

  /** Professional title (kept — not PII). */
  readonly title: string;

  /** Sanitized biography with all PII removed. */
  readonly bioSummary: string;

  /** Declared skills (kept — not PII). */
  readonly skills: readonly string[];

  /** Years of professional experience. */
  readonly experienceYears: number;

  /** Summarised past project descriptions (PII removed, truncated). */
  readonly pastProjectsSummary: readonly string[];
}
