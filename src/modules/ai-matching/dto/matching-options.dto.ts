import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MatchingOptionsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of candidates to return from vector search',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  readonly topK?: number = 20;

  @ApiPropertyOptional({
    description: 'Minimum cosine similarity threshold (0–1) for vector search results',
    example: 0.65,
    default: 0.65,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  readonly minSimilarityScore?: number = 0.65;

  @ApiPropertyOptional({
    description:
      'Locale for prompt template selection and embedding model routing (e.g., "en", "am")',
    example: 'en',
    default: 'en',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  readonly locale?: string = 'en';
}
