import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { StatsRangePreset } from '../types/admin-stats.types';

/**
 * Shared query DTO for Admin Stats endpoints (Phase 2).
 */
export class StatsQueryDto {
  @IsOptional()
  @IsString()
  currency?: string = 'ETB';

  @IsOptional()
  @IsString()
  lang?: string = 'en';

  @IsOptional()
  @IsIn(['7d', '30d', '12m', 'custom'])
  range?: StatsRangePreset = '30d';

  @ValidateIf((o: StatsQueryDto) => o.range === 'custom')
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ValidateIf((o: StatsQueryDto) => o.range === 'custom')
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @IsOptional()
  @IsString()
  tz?: string = 'Africa/Addis_Ababa';

  @IsOptional()
  @IsIn(['freelance'])
  projectScope?: string = 'freelance';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  recentLimit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  applyRangeToProjects?: boolean = false;
}
