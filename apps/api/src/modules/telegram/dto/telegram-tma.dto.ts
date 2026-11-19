import { IsNotEmpty, IsOptional, IsString, IsEnum, IsObject, Matches } from 'class-validator';
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
    description:
      'Ignored. Telegram sign-in no longer creates accounts (they are made in the bot); kept so older clients still pass validation.',
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

/** Telegram's sign-in for the mobile app: the signed details plus the app's challenge (see app-oauth.ts). */
export class TelegramAppLoginDto extends TelegramLoginDto {
  @ApiProperty({ description: "base64url SHA-256 of the app's one-time secret" })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  challenge: string;
}
