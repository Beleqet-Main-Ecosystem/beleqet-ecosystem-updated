export interface RankedCandidate {
  readonly freelancerId: string;
  readonly freelancerName: string;
  readonly rank: number;
  readonly score: number;
  readonly decision: string;
  readonly reasoningSnippet: string;
  readonly matchedSkills: readonly string[];
  readonly skillGaps: readonly string[];
}

export interface MatchResponse {
  readonly sessionId: string;
  readonly jobId: string;
  readonly candidates: readonly RankedCandidate[];
}
