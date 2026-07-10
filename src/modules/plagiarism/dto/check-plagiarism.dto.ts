import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Type of content being checked - helps clients categorize reports.
 */
export enum PlagiarismContentType {
  JOB_DESCRIPTION = 'JOB_DESCRIPTION',
  FREELANCE_JOB = 'FREELANCE_JOB',
  COVER_LETTER = 'COVER_LETTER',
  PROFILE = 'PROFILE',
  COMPANY_PROFILE = 'COMPANY_PROFILE',
  DELIVERABLE = 'DELIVERABLE',
  OTHER = 'OTHER',
}

/**
 * Request body for running a plagiarism similarity check.
 */
export class CheckPlagiarismDto {
  @ApiProperty({ description: 'Text to check for similarity', minLength: 50, maxLength: 50000 })
  @IsString()
  @Length(50, 50000)
  text!: string;

  @ApiPropertyOptional({ enum: PlagiarismContentType })
  @IsOptional()
  @IsEnum(PlagiarismContentType)
  contentType?: PlagiarismContentType;

  @ApiPropertyOptional({
    description: 'Platform entity ID to exclude (e.g. the job being edited)',
  })
  @IsOptional()
  @IsString()
  excludeEntityId?: string;

  @ApiPropertyOptional({
    description: 'Public URLs to compare against (optional legacy support; web search is automatic)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  sourceUrls?: string[];

  @ApiPropertyOptional({
    description: 'Minimum similarity score (0-1) to include in results',
    default: 0.25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  threshold?: number;
}
