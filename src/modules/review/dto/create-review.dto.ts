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

const SUPPORTED_CURRENCIES = (
  process.env.SUPPORTED_CURRENCIES ?? 'USD,EUR,GBP,ETB,NGN,KES'
).split(',');

export class CreateReviewDto {
  @IsUUID('4', { message: 'freelancerId must be a valid UUID v4' })
  freelancerId: string;

  @IsUUID('4', { message: 'customerId must be a valid UUID v4' })
  customerId: string;

  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must be at most 5' })
  rating: number;

  @IsString({ message: 'comment must be a string' })
  @Length(1, 1000, { message: 'comment must be between 1 and 1000 characters' })
  comment: string;

  @IsString({ message: 'locale must be a string' })
  @Length(2, 10)
  locale: string;

  @IsIn(SUPPORTED_CURRENCIES, {
    message: `transactionCurrency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  transactionCurrency: string;

  @IsBoolean({ message: 'gdprConsentGiven must be a boolean' })
  gdprConsentGiven: boolean;
}
