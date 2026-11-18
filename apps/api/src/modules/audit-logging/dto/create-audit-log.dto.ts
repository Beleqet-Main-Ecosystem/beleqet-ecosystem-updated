import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * DTO for creating a domain audit log entry.
 * Used internally and for optional admin/manual writes.
 */
export class CreateAuditLogDto {
  /** Machine-readable event name (e.g. HTTP_REQUEST, AccountLinkSucceeded). */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  eventType!: string;

  /** Related entity identifier. */
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  entityId!: string;

  /** Entity type label (e.g. User, HttpRequest). */
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  entityType!: string;

  /** Arbitrary event metadata (PII is redacted before persistence). */
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  /** Service or worker that produced the event. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  processedBy?: string;

  /** Authenticated actor user id when available. */
  @IsOptional()
  @IsString()
  @MaxLength(191)
  actorUserId?: string;

  /** Client IP address (may be redacted for GDPR). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  /** HTTP method for request audits. */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  httpMethod?: string;

  /** Request path for request audits. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string;

  /** HTTP response status code. */
  @IsOptional()
  @IsInt()
  @Min(100)
  statusCode?: number;

  /** Request duration in milliseconds. */
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}
