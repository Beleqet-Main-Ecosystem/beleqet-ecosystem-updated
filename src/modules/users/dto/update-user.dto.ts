// dto/update-user.dto.ts
import { IsString, IsOptional, IsUrl, IsObject } from 'class-validator';

export class SaveCvDraftDto {
  @IsObject() data: Record<string, unknown>;
}

import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional() @IsString() firstName?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional() @IsString() lastName?: string;

  @ApiProperty({ example: '0912345678', required: false })
  @IsOptional() @IsString() phone?: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', required: false })
  @IsOptional() @IsUrl() avatarUrl?: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsOptional() @IsString() telegramId?: string;

  @ApiProperty({ example: 'Senior Frontend Developer', required: false })
  @IsOptional() @IsString() headline?: string;

  @ApiProperty({ example: 'A passionate developer with 5 years of experience in React.', required: false })
  @IsOptional() @IsString() bio?: string;

  @ApiProperty({ example: 'Addis Ababa, Ethiopia', required: false })
  @IsOptional() @IsString() location?: string;

  @ApiProperty({ example: 'https://drive.google.com/resume.pdf', required: false })
  @IsOptional() @IsUrl() defaultResumeUrl?: string;

  @ApiProperty({ example: 'https://myportfolio.com', required: false })
  @IsOptional() @IsUrl() portfolioUrl?: string;

  @ApiProperty({ example: 'https://github.com/johndoe', required: false })
  @IsOptional() @IsUrl() githubUrl?: string;

  @ApiProperty({ example: 'https://linkedin.com/in/johndoe', required: false })
  @IsOptional() @IsUrl() linkedinUrl?: string;

  @ApiProperty({ example: ['React', 'Node.js', 'TypeScript'], required: false })
  @IsOptional() @IsString({ each: true }) skills?: string[];
}

export class CreateCompanyDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() logoUrl?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() size?: string;

  // New Company fields
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsUrl() linkedinUrl?: string;
  @IsOptional() @IsUrl() twitterUrl?: string;
  @IsOptional() @IsUrl() facebookUrl?: string;
  @IsOptional() @IsString() coverImageUrl?: string;
  @IsOptional() @IsString({ each: true }) benefits?: string[];
  @IsOptional() foundedYear?: number;
}
