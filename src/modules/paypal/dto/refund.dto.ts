import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * @class RefundDto
 * @module PayPal
 * @description Request body for issuing a PayPal refund on a captured payment.
 *
 * **Full refund**: Omit the `amount` field entirely — the entire captured amount is refunded.
 *
 * **Partial refund**: Provide an `amount` value less than the captured total.
 * Multiple partial refunds can be issued against the same capture until the
 * total refunded amount equals the original captured amount.
 *
 * **Audit trail**: Every call to the refund endpoint creates an immutable `PaypalRefund`
 * row in the database regardless of whether it is a full or partial refund.
 *
 * **GDPR**: Any PII in the PayPal refund API response is pseudonymised before storage.
 *
 * @example
 * ```json
 * // Full refund (omit amount):
 * {}
 *
 * // Full refund with note:
 * {
 *   "note": "Client cancelled before delivery"
 * }
 *
 * // Partial refund of $50 USD:
 * {
 *   "amount": 50.00,
 *   "currency": "USD",
 *   "note": "Service delivered partially — 50% refund agreed with client"
 * }
 * ```
 */
export class RefundDto {
  /**
   * Amount to refund. Must be a positive number with at most 2 decimal places.
   *
   * - Omit this field to issue a **full refund** of the entire captured amount.
   * - Provide a value less than the captured total for a **partial refund**.
   * - The maximum value is capped at 100,000 to prevent accidental over-refunds.
   *
   * @example 50.00
   */
  @ApiPropertyOptional({
    example: 50.0,
    description:
      'Partial refund amount (with at most 2 decimal places). ' +
      'Omit to issue a full refund of the entire captured amount.',
    minimum: 0.01,
    maximum: 100_000,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  amount?: number;

  /**
   * ISO-4217 3-letter currency code for the refund amount.
   * Must match the original capture currency if provided.
   * Defaults to the transaction's stored currency when omitted.
   *
   * Only uppercase alphabetic strings of exactly 3 characters are accepted
   * (e.g. `'USD'`, `'EUR'`, `'GBP'`).
   *
   * @example 'USD'
   */
  @ApiPropertyOptional({
    example: 'USD',
    description:
      'ISO-4217 3-letter currency code (must match capture currency). ' +
      'Defaults to the transaction\'s stored currency when omitted.',
    pattern: '^[A-Z]{3}$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a valid ISO-4217 code (e.g. USD, EUR, GBP)',
  })
  currency?: string;

  /**
   * Internal note explaining the reason for the refund (max 255 characters).
   * This is sent to PayPal as `note_to_payer` and stored in the `PaypalRefund` record.
   *
   * Useful for internal audit logs and dispute evidence.
   *
   * @example 'Client requested cancellation before delivery start date'
   */
  @ApiPropertyOptional({
    example: 'Client requested cancellation before delivery start date',
    description:
      'Internal note explaining the refund reason (max 255 chars). ' +
      'Sent to PayPal as note_to_payer.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
