import { IsOptional, IsNumber, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum MatchSortBy {
  TOTAL_SCORE = 'totalScore',
  SKILL_SCORE = 'skillScore',
  CREATED_AT = 'createdAt',
}

export class QueryMatchmakerDto {
  @ApiPropertyOptional({ description: 'Minimum score threshold filter (0-100)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number = 0;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: MatchSortBy, default: MatchSortBy.TOTAL_SCORE })
  @IsOptional()
  @IsEnum(MatchSortBy)
  sortBy?: MatchSortBy = MatchSortBy.TOTAL_SCORE;
}

export class TriggerMatchDto {
  @ApiPropertyOptional({ description: 'Optional candidate ID to calculate match for' })
  @IsOptional()
  @IsString()
  candidateId?: string;
}
