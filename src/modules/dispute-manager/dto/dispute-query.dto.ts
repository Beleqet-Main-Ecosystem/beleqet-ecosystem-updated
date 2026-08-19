import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Validated filters for the administrator dispute queue. */
export class DisputeQueryDto {
  @IsOptional()
  @IsIn(['OPEN', 'RESOLVED', 'ALL'])
  status: 'OPEN' | 'RESOLVED' | 'ALL' = 'ALL';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
