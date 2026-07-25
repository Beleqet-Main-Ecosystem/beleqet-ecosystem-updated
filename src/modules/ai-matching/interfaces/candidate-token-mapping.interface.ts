/**
 * Internal-only mapping between a session-scoped opaque token and the
 * real freelancer identifier.
 *
 * This object must NEVER be included in LLM requests or any data
 * crossing the system boundary to external AI providers.
 */
export interface CandidateTokenMapping {
  /** Session-scoped opaque token sent to the LLM. */
  readonly sessionToken: string;

  /** The real freelancer ID in the platform (never exposed externally). */
  readonly freelancerId: string;
}
