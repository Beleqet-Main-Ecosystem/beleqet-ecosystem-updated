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

@Injectable()
export class ReviewService {
  private readonly maxCommentLength: number = Number(
    process.env.REVIEW_MAX_COMMENT_LENGTH ?? 1000,
  );

  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: IReviewRepository,
  ) {}

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

  async getReviewsForFreelancer(freelancerId: string): Promise<Review[]> {
    return this.reviewRepository.findByFreelancerId(freelancerId);
  }

  async getReviewById(id: string): Promise<Review> {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Review with id ${id} not found`);
    }
    return review;
  }

  async updateReview(id: string, dto: UpdateReviewDto): Promise<Review> {
    await this.getReviewById(id);
    return this.reviewRepository.update(id, dto);
  }

  async anonymizeReview(id: string): Promise<Review> {
    await this.getReviewById(id);
    return this.reviewRepository.update(id, {
      customerId: 'REDACTED',
      comment: 'REDACTED',
      isAnonymized: true,
    });
  }

  async deleteReview(id: string): Promise<void> {
    await this.getReviewById(id);
    await this.reviewRepository.delete(id);
  }
}
