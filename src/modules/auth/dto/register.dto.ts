import { IsEmail, IsString, MinLength, IsIn, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Local enum — avoids dependency on generated Prisma client at compile time.
export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYER = 'EMPLOYER',
  JOB_SEEKER = 'JOB_SEEKER',
  FREELANCER = 'FREELANCER',
}

/** Roles anyone may pick when signing up. Admins are made by an admin, never by sign-up. */
export const SELF_SERVICE_ROLES = [
  UserRole.JOB_SEEKER,
  UserRole.EMPLOYER,
  UserRole.FREELANCER,
] as const;

export class RegisterDto {
  @ApiProperty({ example: 'bisrat@beleqet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Bisrat' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Shiferaw' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: SELF_SERVICE_ROLES, default: UserRole.JOB_SEEKER })
  @IsOptional()
  @IsIn(SELF_SERVICE_ROLES, { message: 'role must be JOB_SEEKER, EMPLOYER or FREELANCER' })
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'bisrat@beleqet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

/** The 6-digit code from the verification email, with the ticket sign-up or sign-in returned. */
export class VerifyEmailCodeDto {
  @ApiProperty({ description: 'verificationToken from the sign-up or sign-in answer' })
  @IsString()
  verificationToken: string;

  @ApiProperty({ example: '482913' })
  @IsString()
  // Six digits; spaces anywhere are fine ("246 810"), the service drops them.
  @Matches(/^\s*(\d\s*){6}$/, { message: 'Enter the 6-digit code from the email.' })
  code: string;
}

export class ResendEmailCodeDto {
  @ApiProperty({ description: 'verificationToken from the sign-up or sign-in answer' })
  @IsString()
  verificationToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'bisrat@beleqet.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangeEmailDto {
  @ApiProperty({ example: 'newemail@example.com' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ example: 'CurrentPass123!' })
  @IsString()
  password: string;
}
