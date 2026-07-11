import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

/**
 * List of ISO 4217 currency codes supported by the platform.
 * Sourced from `process.env` at bootstrap in a real deployment;
 * hardcoded here only as the compiled fallback whitelist used by
 * `class-validator`'s decorator (decorators run at class-definition
 * time, before DI/config is available).
 */
const SUPPORTED_CURRENCIES = (
  process.env.SUPPORTED_CURRENCIES ?? 'USD,EUR,GBP,ETB,NGN,KES'
).split(',');

/**
 * Payload required to create a new freelancer review.
 *
 * All fields are validated with `class-validator` and enforced via
 * the global `ValidationPipe` (see {@link main.ts} bootstrap).
 */
export class CreateReviewDto {
  /** UUID of the freelancer being rated. */
  @IsUUID('4', { message: 'freelancerId must be a valid UUID v4' })
  freelancerId: string;

  /** UUID of the customer leaving the review (injected from auth context, not trusted client input, in production). */
  @IsUUID('4', { message: 'customerId must be a valid UUID v4' })
  customerId: string;

  /** Star rating between 1 and 5. */
  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must be at most 5' })
  rating: number;

  /** Written feedback, 1–1000 characters. */
  @IsString({ message: 'comment must be a string' })
  @Length(1, 1000, { message: 'comment must be between 1 and 1000 characters' })
  comment: string;

  /** BCP-47 locale of the reviewer, e.g. "en-US". Used to localize moderation/notification copy. */
  @IsString({ message: 'locale must be a string' })
  @Length(2, 10)
  locale: string;

  /** ISO 4217 currency of the related transaction. */
  @IsIn(SUPPORTED_CURRENCIES, {
    message: `transactionCurrency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  transactionCurrency: string;

  /** Must be true — GDPR requires explicit, recorded consent to store personal feedback. */
  @IsBoolean({ message: 'gdprConsentGiven must be a boolean' })
  gdprConsentGiven: boolean;
}
