import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PredictBidRequestDto {
  @ApiProperty({ description: 'The Freelance Job UUID' })
  @IsUUID()
  jobId: string;

  @ApiProperty({ description: 'Optional Freelancer User UUID to customize recommendations', required: false })
  @IsOptional()
  @IsUUID()
  freelancerId?: string;
}
