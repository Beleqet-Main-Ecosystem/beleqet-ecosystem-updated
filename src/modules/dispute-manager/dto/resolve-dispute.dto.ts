import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Data Transfer Object for resolving a dispute by an admin.
 */
export class ResolveDisputeDto {
  /**
   * Admin's resolution message or decision.
   */
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  resolution!: string;

  /**
   * If a refund is involved, the amount.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  refundAmount?: number;

  /** ISO-4217 currency of the optional refund; must match the contract and wallet. */
  @ValidateIf((dto: ResolveDisputeDto) => dto.refundAmount !== undefined)
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  refundCurrency?: string;

  /**
   * Language for i18n support in the response
   */
  @IsOptional()
  @IsIn(['en', 'am'])
  lang?: 'en' | 'am' = 'en';
}
