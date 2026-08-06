import { IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object for querying admin statistics
 */
export class StatsQueryDto {
  /**
   * Currency to convert revenue statistics into
   */
  @IsOptional()
  @IsString()
  currency?: string;

  /**
   * Language for i18n support in responses
   */
  @IsOptional()
  @IsString()
  lang?: string;
}
