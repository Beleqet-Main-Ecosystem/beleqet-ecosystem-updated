import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  IsIn,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

// Local enum — mirrors Prisma JobType without requiring generated client
export enum JobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  CONTRACT = 'CONTRACT',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
}

export class CreateJobDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() description: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() requirements?: string;
  @ApiProperty() @IsString() location: string;
  @ApiProperty({ enum: JobType }) @IsEnum(JobType) type: JobType;
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() salaryMin?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() salaryMax?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() deadline?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() featured?: boolean;

  // New extended fields
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() filled?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() urgent?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() jobSite?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() gender?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() salaryType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsInt() vacancies?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() experienceLevel?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() yearsOfExperience?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() qualification?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() applyType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() applyUrl?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() applyEmail?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() contactPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() companyName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() companyLogo?: string;
  @ApiProperty({ required: false, enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
}

// A real class so the update body is validated and whitelisted (companyId can't be set).
export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class QueryJobsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() location?: string;
  /** One job type, or several separated by commas: FULL_TIME,REMOTE */
  @IsOptional() @IsString() type?: string;
  /** Jobs paying at least this much (either end of the range) */
  @IsOptional() @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @IsString() experienceLevel?: string;
  /** Posted in the last N days */
  @IsOptional() @IsInt() @Min(1) @Max(365) postedWithin?: number;
  /** One employer's jobs, for "More jobs from this employer" */
  @IsOptional() @IsString() company?: string;
  /** Leave this job out, e.g. the one being viewed */
  @IsOptional() @IsString() exclude?: string;
  @IsOptional() @IsIn(['newest', 'salary']) sort?: 'newest' | 'salary';
  @IsOptional() @IsInt() @Min(1) page?: number;
  // The sitemap reads 500 at a time.
  @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number;
}
