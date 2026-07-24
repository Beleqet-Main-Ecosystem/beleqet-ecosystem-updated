import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import {
  IReviewRepository,
  REVIEW_REPOSITORY,
} from './interfaces/review-repository.interface';

/**
 * Business logic for creating, retrieving, updating, and erasing
 * freelancer reviews.
 *
 * The service depends only on the {@link IReviewRepository}
 * abstraction (constructor injection via the `REVIEW_REPOSITORY`
 * token), never on a concrete database driver — this satisfies the
 * Dependency Inversion and Single Responsibility principles and keeps
 * the class fully unit-testable with a mock repository.
 *
 * Configuration such as the maximum comment length or moderation
 * toggles is read from `process.env` rather than hardcoded, per the
 * project's no-hardcoded-secrets/config rule.
 */
@Injectable()
export class ReviewService {
  /** Max comment length, overridable via `REVIEW_MAX_COMMENT_LENGTH`. */
  private readonly maxCommentLength: number = Number(
    process.env.REVIEW_MAX_COMMENT_LENGTH ?? 1000,
  );

  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: IReviewRepository,
  ) {}

  /**
   * Creates a new review after enforcing business rules that go
   * beyond simple field validation (which `class-validator` already
   * handles at the DTO layer).
   *
   * @param dto - Validated review submission payload.
   * @returns The persisted {@link Review}.
   * @throws BadRequestException if GDPR consent was not given, or the
   *   comment exceeds the configured maximum length.
   */
  async createReview(dto: CreateReviewDto): Promise<Review> {
    if (!dto.gdprConsentGiven) {
      throw new BadRequestException(
        'GDPR consent is required to submit a review',
      );
    }

    if (dto.comment.length > this.maxCommentLength) {
      throw new BadRequestException(
        `comment exceeds maximum length of ${this.maxCommentLength} characters`,
      );
    }

    const review: Review = {
      id: randomUUID(),
      freelancerId: dto.freelancerId,
      customerId: dto.customerId,
      rating: dto.rating,
      comment: dto.comment,
      locale: dto.locale,
      transactionCurrency: dto.transactionCurrency,
      gdprConsentGiven: dto.gdprConsentGiven,
      isAnonymized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.reviewRepository.create(review);
  }

  /**
   * Retrieves every review submitted for a given freelancer.
   *
   * @param freelancerId - UUID of the freelancer.
   * @returns Array of {@link Review} entities, empty if none exist.
   */
  async getReviewsForFreelancer(freelancerId: string): Promise<Review[]> {
    return this.reviewRepository.findByFreelancerId(freelancerId);
  }

  /**
   * Fetches a single review by id.
   *
   * @param id - UUID of the review.
   * @returns The matching {@link Review}.
   * @throws NotFoundException if no review exists with that id.
   */
  async getReviewById(id: string): Promise<Review> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    return review;
  }

  /**
   * Updates an existing review (e.g. the customer edits their rating
   * or comment within the allowed edit window).
   *
   * @param id - UUID of the review to update.
   * @param dto - Partial update payload.
   * @returns The updated {@link Review}.
   * @throws NotFoundException if no review exists with that id.
   */
  async updateReview(id: string, dto: UpdateReviewDto): Promise<Review> {
    await this.getReviewById(id); // ensures existence, throws 404 otherwise
    return this.reviewRepository.update(id, dto);
  }

  /**
   * Anonymizes a review to satisfy a GDPR "right to erasure" request
   * while preserving the aggregate rating signal (the star rating is
   * kept; personally identifying fields are scrubbed).
   *
   * @param id - UUID of the review to anonymize.
   * @returns The anonymized {@link Review}.
   */
  async anonymizeReview(id: string): Promise<Review> {
    await this.getReviewById(id);
    return this.reviewRepository.update(id, {
      customerId: 'REDACTED',
      comment: 'REDACTED',
      isAnonymized: true,
    });
  }

  /**
   * Permanently deletes a review. Used when a full erasure (rather
   * than anonymization) is legally required.
   *
   * @param id - UUID of the review to delete.
   */
  async deleteReview(id: string): Promise<void> {
    await this.getReviewById(id);
    await this.reviewRepository.delete(id);
  }
}
