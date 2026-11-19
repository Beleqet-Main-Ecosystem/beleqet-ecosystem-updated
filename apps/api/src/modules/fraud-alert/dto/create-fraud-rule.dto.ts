import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFraudRuleDto {
  @ApiProperty({ description: 'Human-readable rule name' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({
    enum: ['OFF_PLATFORM_PAYMENT', 'FAKE_PROFILE', 'PAYMENT_ANOMALY', 'DUPLICATE_LISTING'],
    description: 'Type of fraud this rule detects',
  })
  @IsEnum(['OFF_PLATFORM_PAYMENT', 'FAKE_PROFILE', 'PAYMENT_ANOMALY', 'DUPLICATE_LISTING'])
  ruleType: 'OFF_PLATFORM_PAYMENT' | 'FAKE_PROFILE' | 'PAYMENT_ANOMALY' | 'DUPLICATE_LISTING';

  @ApiProperty({ required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @ApiProperty({
    required: false,
    description: 'JSON configuration for the rule (thresholds, regex patterns, etc.)',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({
    description: 'i18n key for alert messages, e.g. fraud.alert.title.OFF_PLATFORM_PAYMENT',
  })
  @IsString()
  i18nKey: string;
}

export class UpdateFraudRuleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiProperty({ required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  i18nKey?: string;
}
