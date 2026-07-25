import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MatchingOptionsDto } from './matching-options.dto';

export class MatchRequestDto {
  @ApiProperty({
    description: 'The job identifier to match candidates against',
    example: 'job_123',
  })
  @IsString()
  @IsNotEmpty()
  readonly jobId: string;

  @ApiPropertyOptional({
    description: 'Optional matching configuration parameters',
    type: MatchingOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatchingOptionsDto)
  readonly matchingOptions?: MatchingOptionsDto;
}
