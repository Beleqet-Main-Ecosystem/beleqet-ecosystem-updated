import { Review } from '../entities/review.entity';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface IReviewRepository {
  create(review: Review): Promise<Review>;
  findById(id: string): Promise<Review | null>;
  findByFreelancerId(freelancerId: string): Promise<Review[]>;
  update(id: string, partial: Partial<Review>): Promise<Review>;
  delete(id: string): Promise<void>;
}
