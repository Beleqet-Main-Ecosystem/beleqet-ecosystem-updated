import { ThemePreference } from '@prisma/client';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UserPreferencesRepository } from './user-preferences.repository';
export declare class UserPreferencesService {
    private readonly userPreferencesRepository;
    constructor(userPreferencesRepository: UserPreferencesRepository);
    getThemePreference(userId: string): Promise<ThemePreferenceResponseDto>;
    updateThemePreference(userId: string, theme: ThemePreference): Promise<ThemePreferenceResponseDto>;
}
