import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { LoadBalancerStrategy } from '../constants/load-balancer.constants';

/** ISO 4217 currency code pattern (e.g. ETB, USD, EUR). */
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** ISO 3166-1 alpha-2 region code pattern (e.g. ET, US). */
const REGION_PATTERN = /^[A-Z]{2}$/;

export class RegisterBackendDto {
  @ApiProperty({ example: 'backend-eu-1' })
  @IsString()
  @Length(2, 64)
  id!: string;

  @ApiProperty({ example: 'http://backend-1:4000' })
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiPropertyOptional({ example: 'ET', default: 'ET' })
  @IsOptional()
  @IsString()
  @Matches(REGION_PATTERN, { message: 'region must be a 2-letter ISO code' })
  region?: string;

  @ApiPropertyOptional({ example: ['ETB', 'USD'], default: ['ETB'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(CURRENCY_PATTERN, { each: true, message: 'each currency must be ISO 4217' })
  supportedCurrencies?: string[];

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;
}

export class UpdateLoadBalancerConfigDto {
  @ApiPropertyOptional({ enum: LoadBalancerStrategy })
  @IsOptional()
  @IsEnum(LoadBalancerStrategy)
  strategy?: LoadBalancerStrategy;

  @ApiPropertyOptional({ description: 'Enable sticky sessions (session affinity)' })
  @IsOptional()
  @IsBoolean()
  stickySessionsEnabled?: boolean;

  @ApiPropertyOptional({ example: 30_000 })
  @IsOptional()
  @IsInt()
  @Min(5_000)
  @Max(300_000)
  healthCheckIntervalMs?: number;

  @ApiPropertyOptional({ example: '/api/v1/load-balancer/ping' })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  healthCheckPath?: string;
}

export class RouteRequestDto {
  @ApiPropertyOptional({ example: '192.168.1.10' })
  @IsOptional()
  @IsString()
  @Length(3, 45)
  clientIp?: string;

  @ApiPropertyOptional({ description: 'Session ID for sticky-session affinity' })
  @IsOptional()
  @IsString()
  @Length(8, 128)
  sessionId?: string;

  @ApiPropertyOptional({ example: 'ETB', description: 'ISO 4217 currency for multi-currency routing' })
  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN, { message: 'currency must be ISO 4217' })
  currency?: string;

  @ApiPropertyOptional({ example: 'ET' })
  @IsOptional()
  @IsString()
  @Matches(REGION_PATTERN, { message: 'region must be a 2-letter ISO code' })
  region?: string;
}
