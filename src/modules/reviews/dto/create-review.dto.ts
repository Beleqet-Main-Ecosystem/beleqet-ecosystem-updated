/**
 * @file create-review.dto.ts
 * @description
 * Data Transfer Object for creating a new review.
 * Validates that the rating is between 1 and 5 and that a comment is provided.
 *
 * GDPR notes:
 *  - Only stores UUID references (reviewerId, revieweeId, contractId)
 *  - Comment text is user-submitted feedback (consented via platform terms)
 */
import { IsString, IsInt, IsOptional, Min, Max, IsUUID } from 'class-validator';

export class CreateReviewDto {
  /**
   * Optional contract ID to link this review to a specific contract.
   * Ensures the review is tied to an actual collaboration.
   */
  @IsOptional()
  @IsUUID()
  contractId?: string;

  /**
   * ID of the user receiving the review (typically the freelancer).
   */
  @IsString()
  @IsUUID()
  revieweeId: string;

  /**
   * Rating from 1 to 5 stars.
   * Must be an integer within the valid range.
   */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  /**
   * Text feedback/comment about the collaboration.
   * Provides qualitative context for the rating.
   */
  @IsString()
  comment: string;
}
