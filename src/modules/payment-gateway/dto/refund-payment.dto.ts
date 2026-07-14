import {
  IsNumber,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  Min,
  MaxLength,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for refunding a completed transaction.
 */
export class RefundPaymentDto {
  @ApiProperty({
    description: 'Original transaction ID to refund',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly transactionId: string;

  @ApiPropertyOptional({
    description: 'Amount to refund (partial refund supported). If omitted, full refund.',
    example: 50.00,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  readonly amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for refund (i18n key)',
    example: 'refund.reason.serviceNotDelivered',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  readonly reason?: string;
}
