import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';

/**
 * DTO for querying transactions with filters.
 */
export class QueryTransactionsDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  readonly userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'COMPLETED',
    enum: TransactionStatus,
  })
  @IsEnum(TransactionStatus)
  @IsOptional()
  readonly status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    example: 'PAYMENT',
    enum: TransactionType,
  })
  @IsEnum(TransactionType)
  @IsOptional()
  readonly type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by currency',
    example: 'ETB',
  })
  @IsString()
  @IsOptional()
  readonly currency?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  readonly startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  readonly endDate?: string;
}
