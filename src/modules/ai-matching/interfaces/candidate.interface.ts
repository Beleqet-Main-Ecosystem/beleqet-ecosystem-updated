/**
 * A freelancer candidate in the matching pipeline.
 * Represents the raw candidate data as stored in the system,
 * before any sanitization or transformation.
 */
export interface Candidate {
  /** Unique identifier for the candidate record. */
  readonly id: string;

  /** The freelancer's user ID in the platform. */
  readonly freelancerId: string;

  /** Professional title or headline. */
  readonly title: string;

  /** Full biography or summary. */
  readonly bio: string;

  /** List of skills the freelancer has declared. */
  readonly skills: readonly string[];

  /** Years of professional experience. */
  readonly experienceYears: number;

  /** Hourly rate in the account's base currency. */
  readonly hourlyRate: number;

  /** URLs to portfolio items or past work. */
  readonly portfolioUrls: readonly string[];

  /** Past project history. */
  readonly pastProjects: readonly PastProject[];

  /** Whether the freelancer has consented to AI matching. */
  readonly consentGiven: boolean;
}

/**
 * A single past project in a freelancer's history.
 */
export interface PastProject {
  /** Project title. */
  readonly title: string;

  /** Short description of the work performed. */
  readonly description: string;

  /** Skills exercised during this project. */
  readonly skillsUsed: readonly string[];

  /** Duration in months. */
  readonly durationMonths: number;
}
