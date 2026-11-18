import { IsOptional, IsString, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for fetching and filtering audit logs.
 */
export class QueryAuditLogDto {
  /**
   * Filter by specific User ID.
   */
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * Filter by action string (e.g. "CREATE", "UPDATE", "DELETE").
   */
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * Filter by target entity name (e.g. "Job", "User", "Payment").
   */
  @IsOptional()
  @IsString()
  entity?: string;

  /**
   * Filter logs starting from this date ISO string.
   */
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  /**
   * Filter logs up to this date ISO string.
   */
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  /**
   * Target page index for pagination (1-based).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Number of items per page.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
