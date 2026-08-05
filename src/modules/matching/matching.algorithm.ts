/**
 * matching.algorithm.ts
 *
 * Pure scoring functions for the AI Matchmaker module. Deliberately kept
 * free of NestJS/Prisma dependencies so the algorithm itself can be unit
 * tested in isolation from the database layer (see matching.algorithm.spec.ts).
 *
 * All scores are normalized to the 0..1 range internally; the service layer
 * converts the final overallScore to a 0..100 percentage for display.
 */
  export const ALGORITHM_VERSION = 'v1';
/** Minimal shape of a freelancer profile needed for scoring. */
export interface FreelancerProfileInput {
  skills: string[];
  location?: string | null;
  headline?: string | null;
  bio?: string | null;
}

/** Minimal shape of a freelance job posting needed for scoring. */
export interface FreelanceJobInput {
  skills: string[];
  locationPreference?: string | null;
  experienceLevel?: string | null;
  description?: string | null;
}

export interface MatchBreakdown {
  /** 0..1 — weighted coverage of required skills by the freelancer. */
  skillScore: number;
  /** 0..1 — how well freelancer location satisfies job location preference. */
  locationScore: number;
  /** 0..1 — how well freelancer's apparent seniority matches the job's requested level. */
  experienceScore: number;
  /** 0..1 combined score before rounding. */
  overallScore: number;
}

/** Relative importance of each sub-score in the final weighted average. */
const WEIGHTS = {
  skill: 0.65,
  location: 0.15,
  experience: 0.2,
} as const;

/** Keywords used to guess a freelancer's seniority from free-text bio/headline when no structured field exists. */
const SENIORITY_KEYWORDS: Record<string, string[]> = {
  SENIOR: ['senior', 'lead', 'principal', 'expert', 'architect'],
  MID: ['mid', 'intermediate'],
  JUNIOR: ['junior', 'entry', 'graduate', 'intern'],
};

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

/**
 * Computes skill-overlap score as the fraction of the job's *required*
 * skills that the freelancer's profile covers (recall against the job,
 * not the freelancer — a freelancer listing 50 skills shouldn't be
 * penalized for skills the job doesn't need).
 *
 * Returns 0 when the job lists no skills (nothing to match against) rather
 * than 1, so an unscoped job posting doesn't falsely rank everyone highly.
 */
export function computeSkillScore(freelancerSkills: string[], jobSkills: string[]): number {
  if (jobSkills.length === 0) return 0;

  const freelancerSet = new Set(freelancerSkills.map(normalizeToken));
  const jobSet = new Set(jobSkills.map(normalizeToken));

  let matched = 0;
  for (const requiredSkill of jobSet) {
    if (freelancerSet.has(requiredSkill)) {
      matched += 1;
    }
  }

  return matched / jobSet.size;
}

/**
 * Computes a location compatibility score.
 * - A job with no location preference, or an explicit "remote" preference,
 *   is treated as universally compatible (score 1).
 * - An exact case-insensitive match scores 1.
 * - A freelancer with no location on file gets a neutral 0.5 (unknown,
 *   not penalized).
 * - Anything else (mismatched, known locations) scores 0.3 — not zero,
 *   since relocation/travel is sometimes viable for contract work.
 */
export function computeLocationScore(freelancerLocation: string | null | undefined, jobLocationPreference: string | null | undefined): number {
  if (!jobLocationPreference) return 1;
  const jobPref = normalizeToken(jobLocationPreference);
  if (jobPref === 'remote' || jobPref === 'anywhere') return 1;

  if (!freelancerLocation) return 0.5;

  return normalizeToken(freelancerLocation) === jobPref ? 1 : 0.3;
}

/**
 * Best-effort experience-level compatibility score.
 *
 * The schema doesn't have a structured seniority field on User, so this
 * scans headline + bio for seniority keywords as a heuristic signal. When
 * the job specifies no experienceLevel, or no seniority signal is found on
 * either side, the score defaults to a neutral 0.6 rather than 0 or 1 — an
 * unknown match shouldn't tank or inflate the overall score.
 *
 * TODO: replace this heuristic once a structured `seniorityLevel` field
 * (or the SkillAssessmentSession.skillLevel result) is available on User.
 */
export function computeExperienceScore(freelancer: Pick<FreelancerProfileInput, 'headline' | 'bio'>, jobExperienceLevel: string | null | undefined): number {
  if (!jobExperienceLevel) return 0.6;

  const jobLevel = normalizeToken(jobExperienceLevel);
  const text = normalizeToken(`${freelancer.headline ?? ''} ${freelancer.bio ?? ''}`);

  for (const [level, keywords] of Object.entries(SENIORITY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return level.toLowerCase() === jobLevel ? 1 : 0.4;
    }
  }

  return 0.6;
}

/**
 * Combines the sub-scores into a single weighted match breakdown.
 * This is the main entry point the service layer calls per (freelancer, job) pair.
 */
export function computeMatch(freelancer: FreelancerProfileInput, job: FreelanceJobInput): MatchBreakdown {
  const skillScore = computeSkillScore(freelancer.skills, job.skills);
  const locationScore = computeLocationScore(freelancer.location, job.locationPreference);
  const experienceScore = computeExperienceScore(freelancer, job.experienceLevel);

  const overallScore = skillScore * WEIGHTS.skill + locationScore * WEIGHTS.location + experienceScore * WEIGHTS.experience;

  return { skillScore, locationScore, experienceScore, overallScore };
}

/** Converts a 0..1 overallScore to a rounded 0..100 percentage for display/storage. */
export function toPercentage(score: number): number {
  return Math.round(score * 100);
}