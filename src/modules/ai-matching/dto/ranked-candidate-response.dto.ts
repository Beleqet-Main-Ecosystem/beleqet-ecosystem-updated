import { IsArray, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RankedCandidateResponseDto {
  @ApiProperty({
    description: 'The freelancer identifier',
    example: 'freelancer_456',
  })
  @IsString()
  readonly freelancerId: string;

  @ApiProperty({
    description: 'The freelancer display name',
    example: 'John Doe',
  })
  @IsString()
  readonly freelancerName: string;

  @ApiProperty({
    description: 'Position in the ranked list (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  readonly rank: number;

  @ApiProperty({
    description: 'Final combined match score (0–1)',
    example: 0.94,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  readonly score: number;

  @ApiProperty({
    description: 'Human-readable match decision label',
    example: 'STRONG_MATCH',
  })
  @IsString()
  readonly decision: string;

  @ApiProperty({
    description: 'Short snippet of the LLM reasoning for display',
    example: 'Strong alignment on React and Node.js skills with 6 years experience.',
  })
  @IsString()
  readonly reasoningSnippet: string;

  @ApiProperty({
    description: 'Skills that matched between the job and the freelancer',
    example: ['React', 'TypeScript', 'PostgreSQL'],
  })
  @IsArray()
  @IsString({ each: true })
  readonly matchedSkills: readonly string[];

  @ApiProperty({
    description: 'Required skills the freelancer is missing',
    example: ['Docker', 'AWS'],
  })
  @IsArray()
  @IsString({ each: true })
  readonly skillGaps: readonly string[];
}
