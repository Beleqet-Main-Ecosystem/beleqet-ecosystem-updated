/**
 * A job posting that needs to be matched against freelancer candidates.
 * Represents the employer's requirements for the matching pipeline.
 */
export interface Job {
  /** Unique identifier for the job. */
  readonly id: string;

  /** Job title. */
  readonly title: string;

  /** Full job description. */
  readonly description: string;

  /** Skills the freelancer must have. */
  readonly requiredSkills: readonly string[];

  /** Skills that are beneficial but not required. */
  readonly preferredSkills: readonly string[];

  /** Maximum budget for the job. */
  readonly budget: number;

  /** Currency code (e.g., "ETB", "USD"). */
  readonly currency: string;

  /** Locale of the job posting (e.g., "en", "am"). */
  readonly locale: string;

  /** The employer who posted the job. */
  readonly employerId: string;

  /** When the job was created. */
  readonly createdAt: Date;
}

/**
 * A minimal subset of a Job used internally
 * for LLM evaluation prompts and scoring decisions.
 */
export interface JobSummary {
  /** Job title. */
  readonly title: string;

  /** Full job description. */
  readonly description: string;

  /** Required skills for the position. */
  readonly requiredSkills: readonly string[];

  /** Preferred skills for the position. */
  readonly preferredSkills: readonly string[];

  /** Locale of the job (for prompt selection). */
  readonly locale: string;
}
