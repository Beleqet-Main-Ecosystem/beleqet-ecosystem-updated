import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  DEFAULT_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
} from '../smart-skill-tester.constants';

export class GenerateTestDto {
  @ApiProperty({ example: 'React' })
  @IsString()
  @MinLength(2)
  skill: string;

  @ApiProperty({
    example: DEFAULT_QUESTION_COUNT,
    required: false,
    default: DEFAULT_QUESTION_COUNT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUESTION_COUNT)
  questionCount?: number = DEFAULT_QUESTION_COUNT;
}
