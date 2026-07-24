import { ThemePreference } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserPreferencesController } from './user-preferences.controller';
import { UserPreferencesRepository } from './user-preferences.repository';
import { UserPreferencesService } from './user-preferences.service';

describe('Performance Gauge theme persistence flow', () => {
  it('persists a theme selected by the UI payload and returns it on the next read', async () => {
    let persistedTheme: ThemePreference | null = null;
    const repository = {
      findByUserId: jest.fn(async (): Promise<{ theme: ThemePreference } | null> =>
          persistedTheme ? { theme: persistedTheme } : null,
      ),
      save: jest.fn(async (_userId: string, theme: ThemePreference): Promise<{ theme: ThemePreference }> => {
        persistedTheme = theme;
        return { theme };
      }),
    } as unknown as UserPreferencesRepository;
    const controller = new UserPreferencesController(new UserPreferencesService(repository));
    const user: CurrentUserPayload = { userId: 'user-1', email: 'user@example.test', role: 'ADMIN' };

    await expect(controller.updateThemePreference(user, { theme: ThemePreference.DARK })).resolves.toEqual({
      theme: ThemePreference.DARK,
    });
    await expect(controller.getThemePreference(user)).resolves.toEqual({ theme: ThemePreference.DARK });
  });
});
