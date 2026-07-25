import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DisputeResolution {
  RELEASE_TO_FREELANCER = 'RELEASE_TO_FREELANCER',
  REFUND_TO_CLIENT = 'REFUND_TO_CLIENT',
  SPLIT_50_50 = 'SPLIT_50_50',
  PARTIAL_RELEASE = 'PARTIAL_RELEASE',
}

export class ResolveDisputeDto {
  @ApiProperty({ example: 'Both parties agreed to partial refund of 50%.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolution: string;

  @ApiProperty({ enum: DisputeResolution, example: DisputeResolution.RELEASE_TO_FREELANCER })
  @IsEnum(DisputeResolution)
  resolutionType: DisputeResolution;

  @ApiPropertyOptional({
    example: 50,
    description: 'Percentage to release to freelancer (1-99). Only for PARTIAL_RELEASE.',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  partialPercentage?: number;
}
