import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { ReviewService } from './review.service';

/**
 * REST entry points for the Review System module.
 * Validation is enforced globally via `ValidationPipe` in `main.ts`,
 * so every DTO here is guaranteed to satisfy its `class-validator`
 * decorators before reaching the service layer.
 */
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Submits a new review for a freelancer.
   * @param dto - Validated review payload.
   */
  @Post()
  async create(@Body() dto: CreateReviewDto): Promise<Review> {
    return this.reviewService.createReview(dto);
  }

  /**
   * Lists all reviews for a given freelancer.
   * @param freelancerId - UUID of the freelancer.
   */
  @Get('freelancer/:freelancerId')
  async findByFreelancer(
    @Param('freelancerId') freelancerId: string,
  ): Promise<Review[]> {
    return this.reviewService.getReviewsForFreelancer(freelancerId);
  }

  /**
   * Retrieves a single review by id.
   * @param id - UUID of the review.
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Review> {
    return this.reviewService.getReviewById(id);
  }

  /**
   * Edits an existing review.
   * @param id - UUID of the review.
   * @param dto - Partial update payload.
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<Review> {
    return this.reviewService.updateReview(id, dto);
  }

  /**
   * Handles a GDPR erasure request by anonymizing the review's
   * personal data while preserving the aggregate rating.
   * @param id - UUID of the review.
   */
  @Patch(':id/anonymize')
  async anonymize(@Param('id') id: string): Promise<Review> {
    return this.reviewService.anonymizeReview(id);
  }

  /**
   * Permanently deletes a review.
   * @param id - UUID of the review.
   */
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.reviewService.deleteReview(id);
  }
}
