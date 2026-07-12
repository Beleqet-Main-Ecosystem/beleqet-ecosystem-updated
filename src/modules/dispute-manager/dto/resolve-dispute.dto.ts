import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object for resolving a dispute by an admin.
 */
export class ResolveDisputeDto {
  /**
   * Admin's resolution message or decision.
   */
  @IsNotEmpty()
  @IsString()
  resolution: string;

  /**
   * If a refund is involved, the amount.
   */
  @IsOptional()
  @IsNumber()
  refundAmount?: number;

  /**
   * Language for i18n support in the response
   */
  @IsOptional()
  @IsString()
  lang?: string;
}
