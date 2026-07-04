import { IsIn, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SUPPORTED_LANGS = ['en', 'am', 'ar', 'fr'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

/** Request body for the /i18n/format endpoint. */
export class FormatRequestDto {
  /** Target locale code. */
  @ApiProperty({ enum: SUPPORTED_LANGS, example: 'am' })
  @IsIn(SUPPORTED_LANGS)
  lang: SupportedLang;

  /** Numeric value to format (number and currency). */
  @ApiPropertyOptional({ example: 1500.5 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  /** ISO 4217 currency code override (e.g. 'USD', 'ETB'). */
  @ApiPropertyOptional({ example: 'ETB' })
  @IsOptional()
  @IsString()
  currency?: string;

  /** ISO 8601 date string to format. */
  @ApiPropertyOptional({ example: '2025-07-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
