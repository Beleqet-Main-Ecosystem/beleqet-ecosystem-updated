import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for currency conversion request.
 */
export class ConvertCurrencyDto {
  @ApiProperty({
    description: 'Amount to convert',
    example: 100.00,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  readonly amount: number;

  @ApiProperty({
    description: 'Source currency code',
    example: 'USD',
    enum: ['ETB', 'USD', 'EUR', 'GBP'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ETB', 'USD', 'EUR', 'GBP'])
  @MaxLength(3)
  readonly fromCurrency: string;

  @ApiProperty({
    description: 'Target currency code',
    example: 'ETB',
    enum: ['ETB', 'USD', 'EUR', 'GBP'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ETB', 'USD', 'EUR', 'GBP'])
  @MaxLength(3)
  readonly toCurrency: string;
}
