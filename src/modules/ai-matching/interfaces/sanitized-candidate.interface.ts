/**
 * A candidate profile after GDPR sanitization.
 * PII has been stripped and internal IDs replaced with opaque tokens.
 *
 * This is the internal sanitized representation. For the external-facing
 * candidate sent to LLM providers, use LlmCandidateProfile instead.
 */
export interface SanitizedCandidate {
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
