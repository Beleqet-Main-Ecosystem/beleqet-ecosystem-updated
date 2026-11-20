import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class ResolveFraudAlertDto {
  @ApiProperty({
    enum: ['RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED'],
    description: 'Resolution status for the alert',
  })
  @IsEnum(['RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED'])
  status: 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED';

  @ApiProperty({ required: false, description: 'Admin note explaining the resolution' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  resolutionNote?: string;
}
