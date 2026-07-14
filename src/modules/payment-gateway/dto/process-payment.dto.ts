import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for processing a payment with provider-specific token.
 */
export class ProcessPaymentDto {
  @ApiProperty({
    description: 'Transaction ID to process',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly transactionId: string;

  @ApiProperty({
    description: 'Payment method token (Stripe PaymentMethod ID, PayPal token)',
    example: 'pm_1H...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  readonly paymentMethodToken: string;

  @ApiPropertyOptional({
    description: 'Customer IP address for fraud detection',
    example: '192.168.1.1',
  })
  @IsString()
  @IsOptional()
  readonly ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
    example: 'Mozilla/5.0...',
  })
  @IsString()
  @IsOptional()
  readonly userAgent?: string;
}
