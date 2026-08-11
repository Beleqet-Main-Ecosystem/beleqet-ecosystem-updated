import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsISO8601, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MoneyDto } from './money.dto';

/** Name and contact details extracted from the CV. All fields are optional — a CV may omit any of them. */
export class PersonalInfoDto {
  @ApiProperty({ required: false, nullable: true, example: 'Selam Tesfaye' })
  @IsOptional()
  @IsString()
  fullName?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'selam.tesfaye@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '+251911223344' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Addis Ababa, Ethiopia' })
  @IsOptional()
  @IsString()
  location?: string | null;
}

/** A single education entry. All fields are optional — extraction never fails on missing data. */
export class EducationEntryDto {
  @ApiProperty({ required: false, nullable: true, example: 'Addis Ababa University' })
  @IsOptional()
  @IsString()
  institution?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'BSc' })
  @IsOptional()
  @IsString()
  degree?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Computer Science' })
  @IsOptional()
  @IsString()
  fieldOfStudy?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2018-09-01' })
  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2022-06-30' })
  @IsOptional()
  @IsISO8601()
  endDate?: string | null;
}

/** A single work experience entry. All fields are optional — extraction never fails on missing data. */
export class WorkExperienceEntryDto {
  @ApiProperty({ required: false, nullable: true, example: 'Beleqet Technologies' })
  @IsOptional()
  @IsString()
  company?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiProperty({ required: false, nullable: true, example: '2022-07-01' })
  @IsOptional()
  @IsISO8601()
  startDate?: string | null;

  @ApiProperty({ required: false, nullable: true, example: null })
  @IsOptional()
  @IsISO8601()
  endDate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true, type: () => MoneyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  compensation?: MoneyDto | null;
}

/** A single language proficiency entry. All fields are optional — extraction never fails on missing data. */
export class LanguageEntryDto {
  @ApiProperty({ required: false, nullable: true, example: 'Amharic' })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiProperty({ required: false, nullable: true, example: 'Native' })
  @IsOptional()
  @IsString()
  proficiency?: string | null;
}

/**
 * The full structured result produced by Resume Brain for one uploaded CV.
 * This is the canonical shape used across parsing, extraction, persistence,
 * and the HTTP API — a single source of truth for "what a parsed resume is".
 */
export class ExtractedResumeDto {
  @ApiProperty({ type: () => PersonalInfoDto })
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo: PersonalInfoDto;

  @ApiProperty({ type: () => [EducationEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationEntryDto)
  education: EducationEntryDto[];

  @ApiProperty({ type: () => [WorkExperienceEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkExperienceEntryDto)
  workExperience: WorkExperienceEntryDto[];

  @ApiProperty({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiProperty({ type: () => [String] })
  @IsArray()
  @IsString({ each: true })
  certifications: string[];

  @ApiProperty({ type: () => [LanguageEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageEntryDto)
  languages: LanguageEntryDto[];
}
