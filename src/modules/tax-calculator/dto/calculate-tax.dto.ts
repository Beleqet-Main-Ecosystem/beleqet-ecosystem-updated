import { IsEnum, IsInt, IsString, IsUppercase, Length, Matches, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TaxCurrency {
  USD = 'USD',
  ETB = 'ETB',
}

export class CalculateTaxDto {
  @ApiProperty({
    description: 'Gross income in smallest currency unit (cents/Santim). Annual freelancer income.',
    example: 12000000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  grossIncome!: number;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    enum: TaxCurrency,
    example: TaxCurrency.ETB,
  })
  @IsEnum(TaxCurrency)
  currency!: TaxCurrency;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code selecting the tax ruleset',
    example: 'ET',
    minLength: 2,
    maxLength: 2,
  })
  @IsString()
  @IsUppercase()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a 2-letter ISO country code (e.g. US, ET)',
  })
  countryCode!: string;
}

export interface TaxCalculationResult {
  grossIncome: number;
  taxAmount: number;
  netIncome: number;
  currency: TaxCurrency;
  countryCode: string;
  effectiveTaxRate: number;
}
