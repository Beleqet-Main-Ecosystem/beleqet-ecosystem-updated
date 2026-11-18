import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength } from 'class-validator';

/**
 * DTO for the POST /admin/db-index/explain endpoint.
 */
export class ExplainQueryDto {
  /**
   * The SQL statement to analyse.
   * Only SELECT / UPDATE / DELETE statements are accepted.
   * DDL keywords (DROP, CREATE, TRUNCATE, ALTER) are rejected.
   */
  @ApiProperty({
    description: 'SQL statement to run through EXPLAIN ANALYZE.',
    example:
      "SELECT id, title FROM jobs WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 20",
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  sql: string;

  /**
   * Optional positional parameters for parameterised queries ($1, $2, …).
   * Keeps user-supplied values out of the SQL string — GDPR-friendly.
   */
  @ApiPropertyOptional({
    description: 'Positional query parameters ($1, $2, …).',
    type: [String],
    example: ['PUBLISHED', 20],
  })
  @IsOptional()
  @IsArray()
  params?: unknown[];
}
