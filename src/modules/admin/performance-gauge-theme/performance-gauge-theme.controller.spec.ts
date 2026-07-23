import { ThemePreference } from '@prisma/client';
import { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PerformanceGaugeThemeController } from './performance-gauge-theme.controller';
import { PerformanceGaugeThemeService } from './performance-gauge-theme.service';

describe('PerformanceGaugeThemeController', () => {
  const service = {
    getThemePreference: jest.fn<Promise<{ theme: ThemePreference }>, [string]>(),
    updateThemePreference: jest.fn<Promise<{ theme: ThemePreference }>, [string, ThemePreference]>(),
  } as unknown as PerformanceGaugeThemeService;
  const controller = new PerformanceGaugeThemeController(service);
  const user: CurrentUserPayload = { userId: 'user-1', email: 'user@example.test', role: 'ADMIN' };

  beforeEach(() => jest.clearAllMocks());

  it('reads the preference only for the authenticated user', async () => {
    jest.spyOn(service, 'getThemePreference').mockResolvedValue({ theme: ThemePreference.SYSTEM });

    await expect(controller.getThemePreference(user)).resolves.toEqual({ theme: ThemePreference.SYSTEM });
    expect(service.getThemePreference).toHaveBeenCalledWith(user.userId);
  });

  it('updates the authenticated user preference with the validated DTO value', async () => {
    jest.spyOn(service, 'updateThemePreference').mockResolvedValue({ theme: ThemePreference.DARK });

    await expect(controller.updateThemePreference(user, { theme: ThemePreference.DARK })).resolves.toEqual({
      theme: ThemePreference.DARK,
    });
    expect(service.updateThemePreference).toHaveBeenCalledWith(user.userId, ThemePreference.DARK);
  });
});
