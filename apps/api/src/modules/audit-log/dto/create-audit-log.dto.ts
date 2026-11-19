import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * Data Transfer Object for creating an audit log entry.
 */
export class CreateAuditLogDto {
  /**
   * User ID associated with the action, if available.
   */
  @IsOptional()
  @IsString()
  userId?: string;

  /**
   * Action string identifying the operation (e.g., "CREATE_JOB", "GET /api/v1/jobs").
   */
  @IsString()
  action!: string;

  /**
   * Target entity (e.g., "Job", "User", "Payment").
   */
  @IsString()
  entity!: string;

  /**
   * ID of the affected entity, if applicable.
   */
  @IsOptional()
  @IsString()
  entityId?: string;

  /**
   * Previous state payload snapshot prior to mutation.
   */
  @IsOptional()
  @IsObject()
  previousState?: Record<string, unknown>;

  /**
   * New state payload snapshot after mutation or output response.
   */
  @IsOptional()
  @IsObject()
  newState?: Record<string, unknown>;

  /**
   * Client IP address.
   */
  @IsOptional()
  @IsString()
  ipAddress?: string;

  /**
   * Client User-Agent header string.
   */
  @IsOptional()
  @IsString()
  userAgent?: string;
}
