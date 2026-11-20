import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { EmailStatus, EmailType } from '@prisma/client';

/**
 * Query params for GET /admin/emails/logs
 * Powers the Email Logs & Status Viewer dashboard filters.
 */
export class QueryEmailLogDto {
  @IsOptional()
  @IsEnum(EmailStatus)
  status?: EmailStatus;

  @IsOptional()
  @IsEnum(EmailType)
  type?: EmailType;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize: number = 25;
}
