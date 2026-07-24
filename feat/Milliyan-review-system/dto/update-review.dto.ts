import { PartialType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';

/**
 * Payload accepted when a customer edits an existing review
 * (e.g. correcting the rating or comment within an allowed edit window).
 * All fields inherit the validation rules of {@link CreateReviewDto}
 * but are optional.
 */
export class UpdateReviewDto extends PartialType(CreateReviewDto) {}
