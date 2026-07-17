import { IsString, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AnswerDto {
  @ApiProperty({ description: 'ID of the question being answered' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 'React is a library for building user interfaces...' })
  @IsString()
  @MinLength(1)
  answer: string;
}

export class EvaluateAnswersDto {
  @ApiProperty({ description: 'ID of the test to evaluate' })
  @IsString()
  testId: string;

  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
