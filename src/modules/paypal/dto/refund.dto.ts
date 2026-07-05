import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for issuing a PayPal refund on a captured payment.
 * If `amount` is omitted the entire captured amount is refunded.
 */
export class RefundDto {
  @ApiPropertyOptional({
    example: 50.0,
    description:
      'Partial refund amount. Omit this field to issue a full refund.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  amount?: number;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency of the refund amount (must match capture currency)',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    example: 'Client requested cancellation before delivery',
    description: 'Internal note explaining the reason for the refund',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
