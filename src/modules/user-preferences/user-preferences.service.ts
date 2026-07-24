import { Injectable } from '@nestjs/common';
import { ThemePreference } from '@prisma/client';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UserPreferencesRepository } from './user-preferences.repository';

/**
 * Persists the minimal, user-owned theme setting used by the performance gauge.
 * No theme-resolution data, browser details, or operating-system data is stored.
 */
@Injectable()
export class UserPreferencesService {
  /**
   * @param UserPreferencesRepository - persistence boundary for theme preferences
   */
  constructor(private readonly UserPreferencesRepository: UserPreferencesRepository) {}

  /**
   * Reads the caller's saved preference, returning the non-invasive SYSTEM
   * default for a user who has never chosen a preference.
   *
   * @param userId - authenticated user's immutable identifier
   * @returns the persisted preference or SYSTEM
   */
  async getThemePreference(userId: string): Promise<ThemePreferenceResponseDto> {
    const preference = await this.UserPreferencesRepository.findByUserId(userId);

    return { theme: preference?.theme ?? ThemePreference.SYSTEM };
  }

  /**
   * Upserts the caller's preference so a separate read-before-write query is
   * never needed and concurrent updates remain safe.
   *
   * @param userId - authenticated user's immutable identifier
   * @param theme - validated preference to persist
   * @returns the saved preference
   */
  async updateThemePreference(
    userId: string,
    theme: ThemePreference,
  ): Promise<ThemePreferenceResponseDto> {
    const preference = await this.UserPreferencesRepository.save(userId, theme);

    return { theme: preference.theme };
  }
}
