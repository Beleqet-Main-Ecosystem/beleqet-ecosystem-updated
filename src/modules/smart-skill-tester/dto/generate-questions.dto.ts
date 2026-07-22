import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum SkillLevel {
  ENTRY = 'ENTRY',
  MID = 'MID',
  SENIOR = 'SENIOR',
}

export class GenerateQuestionsDto {
  @ApiProperty({
    description: 'Target job role for question generation',
    example: 'Full Stack Developer',
    maxLength: 100,
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .trim()
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ');
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  jobRole!: string;

  @ApiProperty({
    description: 'Candidate skill level',
    enum: SkillLevel,
    example: SkillLevel.MID,
  })
  @IsEnum(SkillLevel)
  skillLevel!: SkillLevel;

  @ApiProperty({
    description: 'UUID of the candidate taking the assessment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId!: string;
}
