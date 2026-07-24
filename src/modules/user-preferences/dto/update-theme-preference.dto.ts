import { ApiProperty } from '@nestjs/swagger';
import { ThemePreference } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';

/** Payload accepted when a signed-in user changes their display theme. */
export class UpdateThemePreferenceDto {
  /** Requested preference; the transform accepts normal UI casing only. */
  @ApiProperty({ enum: ThemePreference, example: ThemePreference.SYSTEM })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ThemePreference)
  theme!: ThemePreference;
}
