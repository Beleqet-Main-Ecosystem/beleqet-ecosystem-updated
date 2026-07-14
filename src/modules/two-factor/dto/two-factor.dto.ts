import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEnrollmentDto {
  @ApiProperty({ description: 'Enrollment token returned from startEnrollment' })
  @IsString()
  @IsNotEmpty()
  enrollmentToken: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class VerifyDto {
  @ApiProperty({ description: 'Temporary token from login challenge' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class BackupCodeDto {
  @ApiProperty({ description: 'Temporary token from login challenge' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: 'Backup code (10 alphanumeric characters)' })
  @IsString()
  @Length(10, 10)
  backupCode: string;
}

export class StepUpDto {
  @ApiProperty({ description: 'Step-up challenge token from sensitive action guard or challenge endpoint' })
  @IsString()
  @IsNotEmpty()
  stepUpToken: string;

  @ApiProperty({ description: '6-digit TOTP code' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty({ description: 'Optional action type for scoped challenge verification', required: false })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiProperty({ description: 'Optional resource ID for scoped challenge verification', required: false })
  @IsString()
  @IsOptional()
  resourceId?: string;
}

export class ChallengeDto {
  @ApiProperty({ description: 'Action type to scope the challenge (e.g. wallet_withdraw, milestone_release)' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: 'Optional resource ID for action-specific scoping', required: false })
  @IsString()
  @IsOptional()
  resourceId?: string;
}

export class Disable2faDto {
  @ApiProperty({ description: 'Current 6-digit TOTP code to confirm disable' })
  @IsString()
  @Length(6, 6)
  code: string;
}
