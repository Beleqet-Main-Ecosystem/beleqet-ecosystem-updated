/**
 * The final result returned after the full matching pipeline completes.
 * Contains ranked candidates with scores and reasoning.
 */
export interface MatchResult {
  /** Unique identifier for this matching session. */
  readonly sessionId: string;

  /** The job that was matched against. */
  readonly jobId: string;

  /** Candidates ranked by combined score, descending. */
  readonly rankedCandidates: readonly RankedCandidate[];

  /** Total number of candidates evaluated across all stages. */
  readonly totalCandidatesConsidered: number;

  /** When the matching pipeline completed. */
  readonly completedAt: Date;
}

/**
 * A single candidate in the final ranked result.
 */
export interface RankedCandidate {
  /** The freelancer's user ID. */
  readonly freelancerId: string;

  /** The freelancer's display name (firstName + lastName). */
  readonly freelancerName: string;

  /** Position in the ranked list (1-based). */
  readonly rank: number;

  /** Final combined score (0–1). */
  readonly combinedScore: number;

  /** Human-readable match decision label. */
  readonly decision: string;

  /** Short snippet of the LLM's reasoning (for display). */
  readonly reasoningSnippet: string;

  /** Skills that matched between the job and the freelancer. */
  readonly matchedSkills: readonly string[];

  /** Required skills the freelancer is missing. */
  readonly skillGaps: readonly string[];
}
