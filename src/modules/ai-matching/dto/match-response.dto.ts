import { IsArray, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RankedCandidateResponseDto } from './ranked-candidate-response.dto';

export class MatchResponseDto {
  @ApiProperty({
    description: 'Unique identifier for this matching session',
    example: 'session_abc123',
  })
  @IsString()
  readonly sessionId: string;

  @ApiProperty({
    description: 'The job that was matched against',
    example: 'job_123',
  })
  @IsString()
  readonly jobId: string;

  @ApiProperty({
    description: 'Ranked candidates sorted by match score descending',
    type: [RankedCandidateResponseDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RankedCandidateResponseDto)
  readonly candidates: readonly RankedCandidateResponseDto[];
}
