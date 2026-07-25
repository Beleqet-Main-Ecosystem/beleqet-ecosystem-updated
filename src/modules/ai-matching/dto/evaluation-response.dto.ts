import { IsArray, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EvaluationResponseDto {
  @ApiProperty({
    description: 'Match decision from the LLM evaluation',
    example: 'STRONG_MATCH',
    enum: ['STRONG_MATCH', 'POTENTIAL_MATCH', 'WEAK_MATCH', 'NOT_A_MATCH'],
  })
  @IsString()
  readonly decision: string;

  @ApiProperty({
    description: 'LLM confidence score (0–1)',
    example: 0.92,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  readonly confidence: number;

  @ApiProperty({
    description: 'Free-text reasoning from the LLM evaluation',
    example: 'The candidate has 5+ years of React experience matching the job requirements.',
  })
  @IsString()
  readonly reasoning: string;

  @ApiProperty({
    description: 'Skills the freelancer is missing for this job',
    example: ['Kubernetes', 'Terraform'],
  })
  @IsArray()
  @IsString({ each: true })
  readonly skillGaps: readonly string[];

  @ApiProperty({
    description: 'Skills where the freelancer exceeds expectations',
    example: ['React', 'TypeScript', 'Node.js'],
  })
  @IsArray()
  @IsString({ each: true })
  readonly strengths: readonly string[];
}
