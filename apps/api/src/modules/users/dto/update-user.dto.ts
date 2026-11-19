// dto/update-user.dto.ts
import {
  IsString,
  IsOptional,
  IsObject,
  IsUrl,
  IsBoolean,
  IsIn,
  Matches,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ClearableUrl } from '../../../common/decorators/clearable-url.decorator';
import { CITY_MAX_LENGTH, COUNTRY_CODE, USER_GENDERS } from '../../../common/utils/residence';

/** An empty string clears the field. */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export class SaveCvDraftDto {
  @IsObject() data: Record<string, unknown>;
}

import { ApiProperty, PartialType } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '0912345678', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
  @ClearableUrl()
  avatarUrl?: string | null;

  @ApiProperty({ example: 'Senior Frontend Developer', required: false })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiProperty({
    example: 'A passionate developer with 5 years of experience in React.',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'Addis Ababa, Ethiopia', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ enum: USER_GENDERS, required: false, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsIn(USER_GENDERS)
  gender?: string | null;

  @ApiProperty({
    example: 'ET',
    description: 'ISO 3166-1 alpha-2',
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => {
    const cleared = emptyToNull({ value });
    return typeof cleared === 'string' ? cleared.trim().toUpperCase() : cleared;
  })
  @IsOptional()
  @Matches(COUNTRY_CODE, { message: 'country must be a two-letter country code' })
  country?: string | null;

  @ApiProperty({ example: 'Addis Ababa', required: false, nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(CITY_MAX_LENGTH)
  city?: string | null;

  @ApiProperty({ example: 'https://drive.google.com/resume.pdf', required: false })
  @ClearableUrl()
  defaultResumeUrl?: string | null;

  @ApiProperty({ example: 'https://myportfolio.com', required: false })
  @ClearableUrl()
  portfolioUrl?: string | null;

  @ApiProperty({ example: 'https://github.com/johndoe', required: false })
  @ClearableUrl()
  githubUrl?: string | null;

  @ApiProperty({ example: 'https://linkedin.com/in/johndoe', required: false })
  @ClearableUrl()
  linkedinUrl?: string | null;

  @ApiProperty({ example: ['React', 'Node.js', 'TypeScript'], required: false })
  @IsOptional()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({
    description: 'Use my profile and searches to personalise my job feed',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  gdprConsent?: boolean;
}

export class UpdateNotificationPreferenceDto {
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  telegramEnabled?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiProperty({ example: 'en', required: false })
  @IsOptional()
  @IsString()
  @IsIn(['en', 'am'])
  language?: string;
}

export class CreateCompanyDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @ClearableUrl() logoUrl?: string | null;
  @ClearableUrl() website?: string | null;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() size?: string;

  // New Company fields
  @IsOptional() @IsString() location?: string;
  @ClearableUrl() linkedinUrl?: string | null;
  @ClearableUrl() twitterUrl?: string | null;
  @ClearableUrl() facebookUrl?: string | null;
  @ClearableUrl() coverImageUrl?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  benefits?: string[];
  /** null clears it. */
  @IsOptional() @IsInt() @Min(1800) @Max(2100) foundedYear?: number | null;
}

/** Editing the company profile: every field optional, and links can be cleared. */
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class RequestVerificationDto {
  @IsUrl({ require_tld: false }) tradeLicenseUrl: string;
}
