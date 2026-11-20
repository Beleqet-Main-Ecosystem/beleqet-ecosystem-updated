import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query params for GET /matching/jobs/:jobId/matches */
export class GetMatchesQueryDto {
  /** Minimum overall score (0-100) to include in results. Defaults to 0. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number = 0;

  /** Max number of ranked results to return. Defaults to 20. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/** Response shape for a single ranked match. */
export class MatchResultDto {
  userId: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  avatarUrl: string | null;
  overallScore: number;
  skillScore: number;
  locationScore: number;
  experienceScore: number;
}

/** Path param DTO shared by matching endpoints. */
export class JobIdParamDto {
  @IsUUID()
  jobId: string;
}
