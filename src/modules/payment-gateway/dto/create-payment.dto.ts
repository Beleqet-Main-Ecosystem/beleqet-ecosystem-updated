import {
  IsString,
  IsNumber,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
  MaxLength,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

/**
 * DTO for creating a new payment transaction.
 * Supports multi-currency with automatic conversion.
 */
export class CreatePaymentDto {
  @ApiProperty({
    description: 'Payment amount in the original currency',
    example: 100.00,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  readonly amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    enum: ['ETB', 'USD', 'EUR', 'GBP'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ETB', 'USD', 'EUR', 'GBP'])
  @MaxLength(3)
  readonly currency: string;

  @ApiProperty({
    description: 'Payment gateway provider',
    example: 'stripe',
    enum: ['stripe', 'paypal'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['stripe', 'paypal'])
  readonly provider: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'PAYMENT',
    enum: TransactionType,
  })
  @IsEnum(TransactionType)
  readonly type: TransactionType;

  @ApiPropertyOptional({
    description: 'Payment description or i18n key',
    example: 'payment.description.jobPremium',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  readonly description?: string;

  @ApiPropertyOptional({
    description: 'User consent for GDPR compliance',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  readonly consentGiven?: boolean = false;

  @ApiProperty({
    description: 'User ID initiating the payment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  readonly userId: string;
}
