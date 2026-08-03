import { PromotionTargetType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, IsUUID, IsISO8601, MaxLength } from 'class-validator';

/** Body for POST /promoted-engine/campaigns */
export class CreateCampaignDto {
  @IsEnum(PromotionTargetType)
  targetType!: PromotionTargetType;

  @IsUUID()
  targetId!: string;

  /** Cost per click, in minor currency units (e.g. cents/santim). */
  @IsInt()
  @IsPositive()
  cpcBid!: number;

  /** Max spend per day, in minor currency units. Must cover at least one click. */
  @IsInt()
  @IsPositive()
  dailyBudget!: number;

  /** Optional lifetime spend cap, in minor currency units. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  totalBudget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string = 'ETB';

  /** Optional campaign end date (ISO 8601). Omit for an open-ended campaign. */
  @IsOptional()
  @IsISO8601()
  endAt?: string;
}

/** Statuses an owner is allowed to set directly via PATCH — lifecycle transitions
 *  like EXHAUSTED/COMPLETED are system-managed, not owner-settable. */
export enum SettableCampaignStatusDto {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

/** Body for PATCH /promoted-engine/campaigns/:id/status */
export class UpdateCampaignStatusDto {
  @IsEnum(SettableCampaignStatusDto)
  status!: SettableCampaignStatusDto;
}

/** Body for POST /promoted-engine/campaigns/:id/events — records an impression/click/conversion. */
export class RecordEventDto {
  @IsEnum(['IMPRESSION', 'CLICK', 'CONVERSION'])
  type!: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
}

/** Query params for GET /promoted-engine/campaigns/:id/analytics */
export class AnalyticsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

/** Query params for GET /promoted-engine/campaigns/active — used by search/listing pages
 *  to fetch the current winning boost for a batch of targets. */
export class ActiveBoostsQueryDto {
  @IsEnum(PromotionTargetType)
  targetType!: PromotionTargetType;

  /** Comma-separated target IDs to check (kept as a single string param; the
   *  controller splits it — avoids needing a custom array-query-param pipe). */
  @IsString()
  targetIds!: string;
}

/** Response shape for a single campaign. */
export class CampaignResponseDto {
  id!: string;
  ownerId!: string;
  targetType!: PromotionTargetType;
  targetId!: string;
  status!: string;
  cpcBid!: number;
  dailyBudget!: number;
  totalBudget!: number | null;
  currency!: string;
  spentToday!: number;
  spentTotal!: number;
  impressions!: number;
  clicks!: number;
  conversions!: number;
  startAt!: Date;
  endAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

/** Response shape for GET /promoted-engine/campaigns/:id/analytics */
export class CampaignAnalyticsDto {
  campaignId!: string;
  impressions!: number;
  clicks!: number;
  conversions!: number;
  /** Click-through rate: clicks / impressions, 0 when impressions is 0. */
  ctr!: number;
  spentTotal!: number;
  spentToday!: number;
  currency!: string;
  status!: string;
}