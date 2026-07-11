/**
 * @file reviews.service.ts
 * @description
 * Service layer for the Review System.
 * Handles business logic for creating and retrieving reviews,
 * calculating rating statistics, and validating reviewer-reviewee relationships.
 *
 * GDPR notes:
 *  - Only stores UUID references (no PII names/emails)
 *  - Comment text is user-submitted feedback (consented via platform terms)
 *
 * Multi-currency: Not applicable (ratings are universal 1-5 scale)
 */
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { I18nService } from 'nestjs-i18n';

/**
 * Rating statistics summary for a freelancer.
 */
export interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Creates a new review for a freelancer.
   *
   * Validates:
   * - Reviewer and reviewee exist
   * - Reviewer is not reviewing themselves
   * - Optional contract exists and belongs to the correct parties
   * - Rating is within valid range (1-5)
   *
   * @param reviewerId - ID of the user creating the review (typically client)
   * @param dto - Review data including rating, comment, and optional contract ID
   * @returns The created review with reviewer and reviewee details
   */
  async createReview(reviewerId: string, dto: CreateReviewDto) {
    // Validate reviewer exists
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
    });
    if (!reviewer) {
      throw new NotFoundException(this.i18n.t('reviews.REVIEWER_NOT_FOUND'));
    }

    // Validate reviewee exists
    const reviewee = await this.prisma.user.findUnique({
      where: { id: dto.revieweeId },
    });
    if (!reviewee) {
      throw new NotFoundException(this.i18n.t('reviews.REVIEWEE_NOT_FOUND'));
    }

    // Prevent self-review
    if (reviewerId === dto.revieweeId) {
      throw new BadRequestException(this.i18n.t('reviews.CANNOT_REVIEW_YOURSELF'));
    }

    // If contractId is provided, validate it exists and belongs to the correct parties
    if (dto.contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: dto.contractId },
        include: { review: true },
      });

      if (!contract) {
        throw new NotFoundException(this.i18n.t('reviews.CONTRACT_NOT_FOUND'));
      }

      // Validate contract ownership
      if (contract.clientId !== reviewerId || contract.freelancerId !== dto.revieweeId) {
        throw new ForbiddenException(this.i18n.t('reviews.CONTRACT_NOT_BELONGS'));
      }

      // Prevent duplicate reviews for the same contract
      if (contract.review) {
        throw new BadRequestException(this.i18n.t('reviews.REVIEW_ALREADY_EXISTS'));
      }

      // Only allow reviews for completed contracts
      if (contract.status !== 'COMPLETED') {
        throw new BadRequestException(this.i18n.t('reviews.CONTRACT_NOT_COMPLETED'));
      }
    }

    // Create the review
    const review = await this.prisma.review.create({
      data: {
        contractId: dto.contractId,
        reviewerId,
        revieweeId: dto.revieweeId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return review;
  }

  /**
   * Retrieves all reviews received by a specific freelancer.
   *
   * @param revieweeId - ID of the freelancer whose reviews are being fetched
   * @returns Array of reviews with reviewer details
   */
  async getFreelancerReviews(revieweeId: string) {
    // Validate reviewee exists
    const reviewee = await this.prisma.user.findUnique({
      where: { id: revieweeId },
    });
    if (!reviewee) {
      throw new NotFoundException(this.i18n.t('reviews.FREELANCER_NOT_FOUND'));
    }

    const reviews = await this.prisma.review.findMany({
      where: { revieweeId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        contract: {
          select: {
            id: true,
            freelanceJob: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews;
  }

  /**
   * Calculates and returns rating statistics for a freelancer.
   *
   * Includes:
   * - Average rating (rounded to 1 decimal place)
   * - Total number of reviews
   * - Distribution of ratings (1-5 stars)
   *
   * @param revieweeId - ID of the freelancer
   * @returns Rating statistics object
   */
  async getFreelancerRatingStats(revieweeId: string): Promise<RatingStats> {
    // Validate reviewee exists
    const reviewee = await this.prisma.user.findUnique({
      where: { id: revieweeId },
    });
    if (!reviewee) {
      throw new NotFoundException(this.i18n.t('reviews.FREELANCER_NOT_FOUND'));
    }

    const reviews = await this.prisma.review.findMany({
      where: { revieweeId },
      select: { rating: true },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0,
        },
      };
    }

    // Calculate average rating
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = Math.round((sum / totalReviews) * 10) / 10;

    // Calculate rating distribution
    const ratingDistribution = {
      fiveStar: reviews.filter((r) => r.rating === 5).length,
      fourStar: reviews.filter((r) => r.rating === 4).length,
      threeStar: reviews.filter((r) => r.rating === 3).length,
      twoStar: reviews.filter((r) => r.rating === 2).length,
      oneStar: reviews.filter((r) => r.rating === 1).length,
    };

    return {
      averageRating,
      totalReviews,
      ratingDistribution,
    };
  }

  /**
   * Retrieves a single review by ID.
   *
   * @param id - ID of the review
   * @returns The review with full details
   */
  async getReviewById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        contract: {
          select: {
            id: true,
            freelanceJob: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(this.i18n.t('reviews.REVIEW_NOT_FOUND'));
    }

    return review;
  }
}
