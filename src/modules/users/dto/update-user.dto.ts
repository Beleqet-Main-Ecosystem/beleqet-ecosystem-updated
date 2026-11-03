// dto/update-user.dto.ts
import { IsString, IsOptional, IsObject, IsUrl, IsBoolean, IsIn } from 'class-validator';
import { ClearableUrl } from '../../../common/decorators/clearable-url.decorator';

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

  @ApiProperty({ example: '123456789', required: false })
  @IsOptional()
  @IsString()
  telegramId?: string;

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
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsString({ each: true }) benefits?: string[];
  @IsOptional() foundedYear?: number;
}

/** Editing the company profile: every field optional, and links can be cleared. */
export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class RequestVerificationDto {
  @IsUrl({ require_tld: false }) tradeLicenseUrl: string;
}
