import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
