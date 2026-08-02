import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignBidModel, CampaignTargetType } from '@prisma/client';

/**
 * DTO for creating a boost campaign. Budget amounts are minor units
 * (santim/cents) in `currencyCode`.
 */
export class CreateCampaignDto {
  @IsEnum(CampaignTargetType)
  targetType!: CampaignTargetType;

  @IsUUID()
  targetId!: string;

  @IsEnum(CampaignBidModel)
  bidModel!: CampaignBidModel;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  bidAmount!: number;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  dailyBudgetCap!: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  totalBudget!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currencyCode?: string = 'ETB';

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;
}

/**
 * Optional query filters for the owner-scoped campaign list.
 */
export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(['DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'COMPLETED', 'REJECTED'])
  status?: string;
}

/**
 * Ranking request used by search/auction surfaces.
 */
export class RankCampaignsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsEnum(CampaignTargetType)
  targetType?: CampaignTargetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
