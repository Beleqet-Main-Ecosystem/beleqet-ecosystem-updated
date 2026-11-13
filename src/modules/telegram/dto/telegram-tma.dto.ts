import { IsNotEmpty, IsOptional, IsString, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TmaUserRole {
  JOB_SEEKER = 'JOB_SEEKER',
  EMPLOYER = 'EMPLOYER',
}

export class TmaAuthDto {
  @ApiProperty({
    description: 'Raw query string (initData) received from window.Telegram.WebApp.initData',
    example: 'query_id=AAHd...&user=%7B%22id%22%3A123456%7D&auth_date=1658428800&hash=3e8958c2...',
  })
  @IsString()
  @IsNotEmpty()
  initData: string;

  @ApiProperty({
    description: 'Optional preferred user role upon new account onboarding',
    enum: TmaUserRole,
    required: false,
    example: TmaUserRole.JOB_SEEKER,
  })
  @IsOptional()
  @IsEnum(TmaUserRole)
  role?: TmaUserRole;
}

/**
 * What Telegram's login button returned (id, first_name, username, photo_url, auth_date, hash…),
 * passed on whole: the signature covers every field, including any Telegram adds later.
 */
export class TelegramLoginDto {
  @ApiProperty({
    description: 'The user object from Telegram.Login.auth / the login widget',
    example: { id: 123456789, first_name: 'Abebe', auth_date: 1763000000, hash: '3e89…' },
  })
  @IsObject()
  data: Record<string, string | number>;
}
