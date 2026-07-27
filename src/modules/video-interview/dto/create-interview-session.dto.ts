import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** A single interview question sent by the employer. */
export class InterviewQuestionDto {
  @ApiProperty({ example: 'q1', description: 'Unique question identifier' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'Tell me about yourself.' })
  @IsString()
  text: string;

  @ApiProperty({ example: 120, description: 'Max recording duration in seconds' })
  @IsInt()
  @Min(15)
  @Max(600)
  durationSec: number;
}

/**
 * DTO for creating a new AI video interview session.
 * Linked to an existing Application; employer defines questions.
 */
export class CreateInterviewSessionDto {
  @ApiProperty({ description: 'Application UUID this interview is attached to' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ type: [InterviewQuestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewQuestionDto)
  questions: InterviewQuestionDto[];

  @ApiPropertyOptional({
    example: '2026-07-10T10:00:00Z',
    description: 'When the interview link becomes active',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    example: '2026-07-15T23:59:59Z',
    description: 'Hard deadline — session expires after this timestamp',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;
}
