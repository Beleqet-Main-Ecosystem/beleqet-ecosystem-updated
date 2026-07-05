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
 * DTO for creating a PayPal one-time payment order.
 * The `idempotencyKey` prevents duplicate charges if the client retries.
 */
export class CreateOrderDto {
  @ApiProperty({ example: 150.0, description: 'Amount to charge (must be > 0)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;

  @ApiProperty({
    example: 'USD',
    description: 'ISO-4217 currency code',
    enum: ['USD', 'EUR', 'GBP', 'AUD', 'CAD'],
  })
  @IsString()
  @IsIn(['USD', 'EUR', 'GBP', 'AUD', 'CAD'], {
    message: 'Unsupported currency. Use USD, EUR, GBP, AUD, or CAD.',
  })
  currency: string;

  @ApiPropertyOptional({
    example: 'gig-uuid-v4',
    description: 'FreelanceJob ID to associate this payment with',
  })
  @IsOptional()
  @IsUUID('4', { message: 'freelanceJobId must be a valid UUID v4' })
  freelanceJobId?: string;

  @ApiPropertyOptional({
    example: 'freelancer-uuid-v4',
    description: 'Freelancer user ID who will receive the payment',
  })
  @IsOptional()
  @IsUUID('4')
  freelancerId?: string;

  @ApiPropertyOptional({
    example: 'abc123-idempotency-key',
    description:
      'Client-supplied idempotency key (max 36 chars). Auto-generated if omitted.',
    maxLength: 36,
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  idempotencyKey?: string;
}
