// dto/create-application.dto.ts
import { IsUUID, IsString, IsOptional, IsUrl, MinLength, MaxLength, IsInt, IsObject, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApplicationDto {
  @ApiProperty({ description: 'UUID of the job being applied to', example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  jobId: string;

  @ApiProperty({ required: false, example: 'I am writing to express my interest in this position. I have over 5 years of experience building scalable backend APIs using NestJS and PostgreSQL...' })
  @IsOptional()
  @IsString()
  @MinLength(50, { message: 'Cover letter must be at least 50 characters long' })
  @MaxLength(10000)
  coverLetter?: string;

  @ApiProperty({ required: false, description: 'URL to uploaded resume/CV', example: 'https://example.com/resume.pdf' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  resumeUrl?: string;

  // New Application fields
  @ApiProperty({ required: false, example: { "Why do you want this job?": "I love coding." } })
  @IsOptional()
  @IsObject()
  screeningAnswers?: Record<string, any>;

  @ApiProperty({ required: false, example: 'https://github.com/beleqet' })
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;

  @ApiProperty({ required: false, example: 50000 })
  @IsOptional()
  @IsInt()
  expectedSalary?: number;
}

export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  SCREENING = 'SCREENING',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus', example: ApplicationStatus.SHORTLISTED })
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;
}
