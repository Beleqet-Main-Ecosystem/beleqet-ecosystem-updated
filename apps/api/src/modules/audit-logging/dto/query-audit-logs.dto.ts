import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Query parameters for listing / exporting audit logs from the admin API.
 */
export class QueryAuditLogsDto {
  /** Filter by exact event type. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventType?: string;

  /** Filter by related entity id. */
  @IsOptional()
  @IsString()
  @MaxLength(191)
  entityId?: string;

  /** Filter by entity type. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  /** Filter by authenticated actor. */
  @IsOptional()
  @IsString()
  @MaxLength(191)
  actorUserId?: string;

  /** Filter by HTTP method (GET, POST, …). */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  httpMethod?: string;

  /** Filter by request path (contains match). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;

  /** Filter by HTTP status code. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  /** Inclusive lower bound for createdAt (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound for createdAt (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** Free-text search across path, eventType, and entityId. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  search?: string;

  /** 1-based page index. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Page size (max 100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Response language (i18n). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  lang?: string;

  /** Display currency for monetary payload fields. */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  /** Export format when calling the export endpoint (`json` | `csv`). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  format?: string;
}
