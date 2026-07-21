import { IsString, IsNotEmpty, IsEnum, IsUUID, IsObject, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class SubscribeDto {
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @IsUUID()
  @IsNotEmpty()
  priceId: string;

  @IsString()
  @IsNotEmpty()
  currency: string;
}

export class PlanPriceDto {
  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNotEmpty()
  amount: number; // In cents / smallest unit

  @IsEnum(BillingInterval)
  interval: BillingInterval;
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsObject()
  @IsNotEmpty()
  name: Record<string, string>; // e.g. { en: 'Pro Plan', am: 'ፕሮ ዕቅድ' }

  @IsObject()
  @IsOptional()
  description?: Record<string, string>;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsObject()
  @IsNotEmpty()
  limits: Record<string, any>; // e.g. { maxJobs: 15 }

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices: PlanPriceDto[];
}
