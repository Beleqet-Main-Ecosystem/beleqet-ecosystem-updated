/**
 * An embedding vector associated with a freelancer candidate.
 * Separated from the Candidate domain object because embedding
 * lifecycle (generation, storage, search) is independent from
 * freelancer profile data.
 */
export interface CandidateEmbedding {
  /** The candidate record this embedding belongs to. */
  readonly candidateId: string;

  /** The embedding vector values. */
  readonly vector: readonly number[];

  /** Name of the model that produced this embedding. */
  readonly model: string;

  /** Dimensionality of the vector. */
  readonly dimensions: number;
}
