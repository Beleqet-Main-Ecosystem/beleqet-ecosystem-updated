/**
 * @file create-plan.dto.ts
 * @description DTO for creating a subscription Plan (admin only).
 */
import {
  IsString,
  IsInt,
  IsPositive,
  IsUppercase,
  Length,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingInterval } from '@prisma/client';

export class CreatePlanDto {
  /** Unique display name for the plan, e.g. "Pro". */
  @ApiProperty({ description: 'Unique plan name', example: 'Pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiPropertyOptional({ description: 'Human-readable plan description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Price in smallest currency unit (e.g. cents, santim). */
  @ApiProperty({ description: 'Price in minor units (e.g. cents/santim)', example: 99900 })
  @IsInt()
  @IsPositive()
  priceAmount: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code', example: 'ETB', default: 'ETB' })
  @IsOptional()
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency?: string = 'ETB';

  @ApiPropertyOptional({ enum: BillingInterval, default: BillingInterval.MONTHLY })
  @IsOptional()
  @IsEnum(BillingInterval)
  interval?: BillingInterval = BillingInterval.MONTHLY;

  /** Free-form feature map, e.g. { "maxJobPosts": 5, "support": "email" }. */
  @ApiProperty({
    description: 'Feature flags / limits for this plan',
    example: { maxJobPosts: 5, support: 'email' },
  })
  @IsObject()
  features: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  /** PayPal billing plan id — required for the plan to be checkout-able via PayPal. */
  @ApiPropertyOptional({ description: 'PayPal billing plan id (P-XXXXXXXXX)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paypalPlanId?: string;
}
