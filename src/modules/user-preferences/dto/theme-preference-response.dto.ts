import { ApiProperty } from '@nestjs/swagger';
import { ThemePreference } from '@prisma/client';

/** Stable API representation of the user's persisted theme preference. */
export class ThemePreferenceResponseDto {
  /** Preference selected by the user. */
  @ApiProperty({ enum: ThemePreference, example: ThemePreference.SYSTEM })
  theme!: ThemePreference;
}
