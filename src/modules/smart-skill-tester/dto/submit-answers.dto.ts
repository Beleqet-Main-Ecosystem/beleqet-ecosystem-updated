import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class AnswerSubmissionDto {
  @ApiProperty({
    description: 'UUID of the assessment question',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  questionId!: string;

  @ApiProperty({
    description: 'Option selected by the candidate',
    example: 'A',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  selectedOption!: string;
}

export class SubmitAnswersDto {
  @ApiProperty({
    description: 'UUID of the skill assessment session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sessionId!: string;

  @ApiProperty({
    description: 'Candidate answers keyed by question',
    type: [AnswerSubmissionDto],
    maxItems: 20,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AnswerSubmissionDto)
  answers!: AnswerSubmissionDto[];
}
