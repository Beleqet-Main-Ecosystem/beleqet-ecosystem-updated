/**
 * @file create-paypal-order.dto.ts
 * @description DTO for creating a PayPal Checkout order.
 *
 * Supports:
 *  - One-time payments (CAPTURE intent)
 *  - Subscription/recurring payments (via separate subscriptionPlanId flow)
 *  - Multi-currency (ISO 4217)
 *  - GDPR-safe custom_id field (mapped to userId, not raw PII)
 */
import {
  IsString,
  IsNumber,
  IsPositive,
  IsUppercase,
  Length,
  IsOptional,
  IsEnum,
  IsUrl,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** PayPal order intent — CAPTURE for immediate payment, AUTHORIZE to reserve funds. */
export enum PaypalOrderIntent {
  CAPTURE   = 'CAPTURE',
  AUTHORIZE = 'AUTHORIZE',
}

export class CreatePaypalOrderDto {
  /**
   * Total amount to be charged.
   * Must match the smallest denomination your currency uses.
   */
  @ApiProperty({
    description: 'Payment amount (2 decimal places for most currencies)',
    example: 25.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  /**
   * ISO 4217 currency code — uppercase 3-letter code.
   * PayPal supports major world currencies including ETB.
   */
  @ApiProperty({
    description: 'ISO 4217 3-letter currency code',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency: string;

  /**
   * Beleqet user UUID for associating the payment record.
   * Stored as `custom_id` on the PayPal order (not raw email/name).
   */
  @ApiProperty({
    description: 'UUID of the Beleqet user initiating the payment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  /**
   * Order intent: CAPTURE (charge immediately) or AUTHORIZE (reserve funds).
   * Defaults to CAPTURE for standard job-posting payments.
   */
  @ApiPropertyOptional({
    description: 'PayPal order intent',
    enum: PaypalOrderIntent,
    default: PaypalOrderIntent.CAPTURE,
  })
  @IsOptional()
  @IsEnum(PaypalOrderIntent)
  intent?: PaypalOrderIntent = PaypalOrderIntent.CAPTURE;

  /**
   * Optional description shown in the PayPal payer's transaction history.
   */
  @ApiPropertyOptional({
    description: 'Payment description shown in payer PayPal account',
    example: 'Beleqet Premium Job Posting',
    maxLength: 127,
  })
  @IsOptional()
  @IsString()
  @Length(1, 127)
  description?: string;

  /**
   * URL to redirect the payer after successful payment approval.
   * Must be an HTTPS URL in production.
   */
  @ApiPropertyOptional({
    description: 'Return URL after PayPal approval (must be HTTPS in prod)',
    example: 'https://beleqet.com/payment/success',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  /**
   * URL to redirect the payer if they cancel the payment.
   */
  @ApiPropertyOptional({
    description: 'Cancel URL if payer cancels at PayPal',
    example: 'https://beleqet.com/payment/cancel',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;

  /**
   * Optional PayPal subscription plan ID for recurring billing flows.
   * When provided, the service switches to subscription creation instead
   * of a one-time order.
   */
  @ApiPropertyOptional({
    description: 'PayPal Billing Plan ID for subscription/recurring payments',
    example: 'P-12345678901234567ABCDEFG',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  subscriptionPlanId?: string;

  /**
   * How many billing cycles to run (1–999). Only used with subscriptionPlanId.
   */
  @ApiPropertyOptional({
    description: 'Number of billing cycles (for subscriptions)',
    example: 12,
    minimum: 1,
    maximum: 999,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(999)
  @Type(() => Number)
  cycles?: number;
}
