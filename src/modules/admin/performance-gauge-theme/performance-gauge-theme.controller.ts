import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ThemePreferenceResponseDto } from './dto/theme-preference-response.dto';
import { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto';
import { PerformanceGaugeThemeService } from './performance-gauge-theme.service';

/** Secured API for the Performance Gauge's user-owned colour-theme setting. */
@ApiTags('user-preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user-preferences/theme')
export class PerformanceGaugeThemeController {
  /**
   * @param performanceGaugeThemeService - feature service injected by Nest
   */
  constructor(private readonly performanceGaugeThemeService: PerformanceGaugeThemeService) {}

  /**
   * Returns the authenticated user's theme preference.
   *
   * @param user - trusted payload supplied by the JWT guard
   * @returns the saved preference, or SYSTEM when none has been saved
   */
  @Get()
  @ApiOperation({ summary: 'Get the current user theme preference' })
  getThemePreference(@CurrentUser() user: CurrentUserPayload): Promise<ThemePreferenceResponseDto> {
    return this.performanceGaugeThemeService.getThemePreference(user.userId);
  }

  /**
   * Updates only the authenticated user's theme preference.
   *
   * @param user - trusted payload supplied by the JWT guard
   * @param dto - whitelist-validated preference update
   * @returns the persisted preference
   */
  @Patch()
  @ApiOperation({ summary: 'Update the current user theme preference' })
  updateThemePreference(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateThemePreferenceDto,
  ): Promise<ThemePreferenceResponseDto> {
    return this.performanceGaugeThemeService.updateThemePreference(user.userId, dto.theme);
  }
}
