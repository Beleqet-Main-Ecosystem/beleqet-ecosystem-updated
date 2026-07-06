import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFraudAlertsDto {
  @ApiProperty({ required: false, enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsString()
  severity?: string;

  @ApiProperty({ required: false, enum: ['OFF_PLATFORM_PAYMENT', 'FAKE_PROFILE', 'PAYMENT_ANOMALY', 'DUPLICATE_LISTING'] })
  @IsOptional()
  @IsString()
  ruleType?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false, default: 'createdAt' })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiProperty({ required: false, enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
