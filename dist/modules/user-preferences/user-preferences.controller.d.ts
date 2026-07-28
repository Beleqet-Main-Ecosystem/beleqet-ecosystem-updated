import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto';
import { UserPreferencesService } from './user-preferences.service';
export declare class UserPreferencesController {
    private readonly userPreferencesService;
    constructor(userPreferencesService: UserPreferencesService);
    getThemePreference(user: CurrentUserPayload): Promise<ThemePreferenceResponseDto>;
    updateThemePreference(user: CurrentUserPayload, dto: UpdateThemePreferenceDto): Promise<ThemePreferenceResponseDto>;
}
