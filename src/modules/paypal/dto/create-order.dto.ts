import {
  IsNumber,
  IsString,
  IsIn,
  IsOptional,
  Min,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * @class CreateOrderDto
 * @module PayPal
 * @description Request body for creating a PayPal one-time payment order.
 *
 * The `idempotencyKey` prevents duplicate charges if the client retries the
 * request due to a network timeout. It is sent as the `PayPal-Request-Id`
 * header to the PayPal Orders API and stored as a unique constraint in the database.
 *
 * **Currency note**: `ETB` (Ethiopian Birr) is accepted in mock/simulator mode only.
 * The backend will reject ETB with a `400 BadRequestException` if `PAYPAL_MODE` is
 * set to `sandbox` or `live`, because PayPal does not support ETB natively.
 *
 * **Platform fee**: A 5% platform fee is calculated server-side and stored with the
 * transaction. It is NOT added to the charge amount sent to PayPal.
 *
 * @example
 * ```json
 * // Minimal request (idempotency key auto-generated):
 * {
 *   "amount": 150.00,
 *   "currency": "USD"
 * }
 *
 * // Full request with all optional fields:
 * {
 *   "amount": 75.50,
 *   "currency": "EUR",
 *   "freelancerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
 *   "freelanceJobId": "a2fd1c8b-12e3-4f92-9d2b-4c6e18b3c7e1",
 *   "idempotencyKey": "order-attempt-001-2026-07-05"
 * }
 *
 * // Mock-mode only (ETB accepted in simulator):
 * {
 *   "amount": 5000.00,
 *   "currency": "ETB"
 * }
 * ```
 */
export class CreateOrderDto {
  /**
   * The amount to charge the buyer.
   * Must be a positive number with at most 2 decimal places.
   * The minimum chargeable amount is $0.01 (or equivalent in the selected currency).
   *
   * @example 150.00
   */
  @ApiProperty({
    example: 150.0,
    description:
      'Amount to charge the buyer. Must be > 0 with at most 2 decimal places.',
    minimum: 0.01,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;

  /**
   * ISO-4217 three-letter currency code.
   * Accepted values for live/sandbox: `USD`, `EUR`, `GBP`, `AUD`, `CAD`.
   * `ETB` is additionally accepted in mock mode for local simulation demos.
   *
   * @example 'USD'
   */
  @ApiProperty({
    example: 'USD',
    description:
      'ISO-4217 3-letter currency code. ETB is accepted in mock mode only.',
    enum: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ETB'],
  })
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ETB'], {
    message: 'Unsupported currency. Use USD, EUR, GBP, AUD, CAD, or ETB (mock mode only).',
  })
  currency: string;

  /**
   * UUID v4 of the FreelanceJob to associate this payment with.
   * Optional — for standalone payments not linked to a specific gig, omit this field.
   *
   * @example '3fa85f64-5717-4562-b3fc-2c963f66afa6'
   */
  @ApiPropertyOptional({
    example: 'a2fd1c8b-12e3-4f92-9d2b-4c6e18b3c7e1',
    description: 'UUID v4 of the FreelanceJob to associate this payment with',
  })
  @IsOptional()
  @IsUUID('4', { message: 'freelanceJobId must be a valid UUID v4' })
  freelanceJobId?: string;

  /**
   * UUID v4 of the freelancer who will receive the payment after capture.
   * Optional — for subscriptions or admin-initiated payments, omit this field.
   *
   * @example '3fa85f64-5717-4562-b3fc-2c963f66afa6'
   */
  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'UUID v4 of the freelancer who will receive the payment',
  })
  @IsOptional()
  @IsUUID('4')
  freelancerId?: string;

  /**
   * Client-supplied idempotency key (maximum 36 characters).
   * If omitted, a UUID v4 is auto-generated server-side.
   *
   * **Best practice**: Generate this client-side and store it before the API call.
   * If the call fails due to a network error, retry with the same key to avoid
   * double-charging the buyer.
   *
   * @example 'order-attempt-001-2026-07-05'
   */
  @ApiPropertyOptional({
    example: 'order-attempt-001-2026-07-05',
    description:
      'Client-supplied idempotency key (max 36 chars). Auto-generated if omitted. ' +
      'Use the same key when retrying to prevent duplicate orders.',
    maxLength: 36,
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  idempotencyKey?: string;
}
