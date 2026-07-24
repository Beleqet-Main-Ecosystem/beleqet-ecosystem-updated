import { Review } from '../entities/review.entity';

/**
 * DI token used to inject a concrete {@link IReviewRepository}
 * implementation (e.g. TypeORM, Prisma, in-memory for tests).
 * Using a Symbol avoids collisions and allows the ReviewService to
 * depend only on the abstraction (Dependency Inversion Principle).
 */
export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

/**
 * Storage-agnostic contract for persisting and retrieving reviews.
 * Any persistence technology can implement this interface without
 * the service layer changing.
 */
export interface IReviewRepository {
  /** Persists a new review and returns the stored entity. */
  create(review: Review): Promise<Review>;

  /** Finds a single review by its id, or null if not found. */
  findById(id: string): Promise<Review | null>;

  /** Returns all reviews for a given freelancer. */
  findByFreelancerId(freelancerId: string): Promise<Review[]>;

  /** Updates an existing review and returns the updated entity. */
  update(id: string, partial: Partial<Review>): Promise<Review>;

  /** Hard-deletes a review (used for GDPR erasure requests). */
  delete(id: string): Promise<void>;
}
