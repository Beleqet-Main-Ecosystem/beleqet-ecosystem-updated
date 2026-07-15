/**
 * @file create-payment-intent.dto.ts
 * @description DTO for creating a Stripe Payment Intent.
 *
 * Global Scaling compliance:
 *  - `currency` is validated against the ISO 4217 3-letter code format.
 *  - Supports 135+ currencies processed by Stripe.
 *  - `metadata` is optional and GDPR-sanitised before storage (see StripeService).
 */
import {
  IsInt,
  IsString,
  IsUppercase,
  Length,
  Min,
  IsOptional,
  IsObject,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Allowed Stripe payment method types. Extend as needed. */
export enum StripePaymentMethod {
  CARD       = 'card',
  SEPA_DEBIT = 'sepa_debit',
  KLARNA     = 'klarna',
  IDEAL      = 'ideal',
  AFTERPAY   = 'afterpay_clearpay',
  PAYPAL     = 'paypal',
}

export class CreatePaymentIntentDto {
  /**
   * Amount to charge in the **smallest currency unit** (e.g. cents for USD).
   * Minimum 1 (Stripe requirement).
   */
  @ApiProperty({
    description: 'Amount in the smallest currency unit (e.g. 1500 = $15.00 USD)',
    example: 1500,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount: number;

  /**
   * ISO 4217 currency code — must be 3 uppercase letters.
   * Stripe supports 135+ currencies: https://stripe.com/docs/currencies
   */
  @ApiProperty({
    description: 'ISO 4217 3-letter currency code (e.g. USD, EUR, ETB)',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency: string;

  /**
   * Beleqet user UUID — used to associate the payment with an account.
   * Must match the authenticated session user.
   */
  @ApiProperty({
    description: 'UUID of the Beleqet user initiating the payment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  /**
   * Optional description shown on the Stripe dashboard and receipt.
   * Sanitised to remove PII before being forwarded to Stripe.
   */
  @ApiPropertyOptional({
    description: 'Human-readable description of the payment (e.g. "Job Posting - Senior Dev")',
    example: 'Job Posting Fee - Senior Developer',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  description?: string;

  /**
   * Optional payment method type. Defaults to 'card' if omitted.
   * Allows non-card payments for global users (Klarna, iDEAL, SEPA…).
   */
  @ApiPropertyOptional({
    description: 'Stripe payment method type',
    enum: StripePaymentMethod,
    default: StripePaymentMethod.CARD,
  })
  @IsOptional()
  @IsEnum(StripePaymentMethod)
  paymentMethodType?: StripePaymentMethod = StripePaymentMethod.CARD;

  /**
   * Arbitrary key-value metadata stored on the Stripe object.
   * PII values are stripped before being forwarded (GDPR compliance).
   */
  @ApiPropertyOptional({
    description: 'Optional metadata key-value pairs (GDPR-sanitised before storage)',
    example: { jobId: 'abc123', planTier: 'premium' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
