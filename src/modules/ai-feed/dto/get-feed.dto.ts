import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters accepted by `GET /ai-feed`.
 *
 * Validated with `class-validator` and coerced from query-string values
 * (which arrive as strings) into numbers via `class-transformer`.
 */
export class GetFeedDto {
  /**
   * Maximum number of recommended jobs to return.
   * Bounded to a sane range (1-20) to avoid accidental large-payload requests.
   * Defaults to 5 when omitted.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}