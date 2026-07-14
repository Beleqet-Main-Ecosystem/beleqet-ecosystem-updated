/**
 * @file reviews.controller.ts
 * @description
 * REST API controller for the Review System.
 * Exposes endpoints for creating reviews, retrieving freelancer reviews,
 * and getting rating statistics.
 *
 * Endpoints:
 * - POST /reviews: Submit a new review (protected by JWT auth)
 * - GET /reviews/freelancer/:id: Get reviews for a freelancer
 * - GET /reviews/stats/:id: Get rating statistics for a freelancer
 * - GET /reviews/:id: Get a single review by ID
 *
 * GDPR notes:
 *  - Only returns UUID references and user-submitted feedback
 *  - No PII beyond what users consented to share
 */
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Creates a new review for a freelancer.
   *
   * Only clients can review freelancers after contract completion.
   * The review is linked to a specific contract for verification.
   *
   * @param user - Current authenticated user (from JWT token)
   * @param dto - Review data including rating, comment, and optional contract ID
   * @returns The created review with reviewer and reviewee details
   */
  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Not authorized to create this review' })
  @ApiResponse({ status: 404, description: 'User or contract not found' })
  async createReview(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(user.userId, dto);
  }

  /**
   * Retrieves all reviews received by a specific freelancer.
   *
   * Returns reviews in descending order by creation date.
   * Each review includes reviewer details and linked contract information.
   *
   * @param id - ID of the freelancer whose reviews are being fetched
   * @returns Array of reviews with reviewer and contract details
   */
  @Get('freelancer/:id')
  @ApiOperation({ summary: 'Get reviews for a freelancer' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Freelancer not found' })
  async getFreelancerReviews(@Param('id') id: string) {
    return this.reviewsService.getFreelancerReviews(id);
  }

  /**
   * Retrieves rating statistics for a freelancer.
   *
   * Returns:
   * - Average rating (rounded to 1 decimal place)
   * - Total number of reviews
   * - Distribution of ratings (1-5 stars)
   *
   * @param id - ID of the freelancer
   * @returns Rating statistics object
   */
  @Get('stats/:id')
  @ApiOperation({ summary: 'Get rating statistics for a freelancer' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Freelancer not found' })
  async getFreelancerRatingStats(@Param('id') id: string) {
    return this.reviewsService.getFreelancerRatingStats(id);
  }

  /**
   * Retrieves a single review by ID.
   *
   * Returns full review details including reviewer, reviewee, and contract information.
   *
   * @param id - ID of the review
   * @returns The review with full details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiResponse({ status: 200, description: 'Review retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async getReviewById(@Param('id') id: string) {
    return this.reviewsService.getReviewById(id);
  }
}
