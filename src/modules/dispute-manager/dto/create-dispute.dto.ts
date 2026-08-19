import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Data Transfer Object for creating a new dispute.
 */
export class CreateDisputeDto {
  /**
   * The UUID of the contract being disputed
   */
  @IsNotEmpty()
  @IsUUID()
  contractId: string;

  /**
   * The reason for the dispute (e.g. quality of work, deadline delays)
   */
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason!: string;

  /**
   * URLs of evidence provided by the user
   */
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  evidenceUrls!: string[];

  /** Preferred response language. */
  @IsOptional()
  @IsIn(['en', 'am'])
  lang?: 'en' | 'am' = 'en';
}
